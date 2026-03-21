import { exec, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import mime from 'mime-types'
import Redis from 'ioredis'
import dotenv from 'dotenv'
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { readBuilderEnv } from '@/config/env'
import { LogPublisher } from '@/application/ports/log-publisher'
import { RedisLogPublisher } from '@/infrastructure/redis-log-publisher'
import { collectTreeStats, FileTreeNode } from '@/domain/file-tree'
import { formatBytes } from '@/infrastructure/utils/formatters'

dotenv.config()

const configEnv = readBuilderEnv()

const redis = new Redis(configEnv.REDIS_URL)
const logPublisher: LogPublisher = new RedisLogPublisher(redis, configEnv.PROJECT_ID)

const s3Client = new S3Client({
   endpoint: configEnv.MINIO_ENDPOINT,
   region: 'us-east-1',
   credentials: {
    accessKeyId: configEnv.MINIO_ACCESS_KEY,
    secretAccessKey: configEnv.MINIO_SECRET_KEY
   },
   forcePathStyle: true
})

function buildFileTree(localPath: string, s3Prefix: string): FileTreeNode {
   const name = path.basename(localPath)
   const stat = fs.lstatSync(localPath)

   const node: FileTreeNode = {
      name, // builder
      localPath, 
      s3Key: s3Prefix.replace(/\\/g, '/'),
      isDirectory: stat.isDirectory(), 
      size: stat.isDirectory() ? 0 : stat.size,
      children: [] //[/src,/]
   }

   if (stat.isDirectory()) {
      const entries = fs.readdirSync(localPath)
      for (const entry of entries) {
         const childLocalPath = path.join(localPath, entry)
         const childS3Key = path.join(s3Prefix, entry).replace(/\\/g, '/')
         node.children.push(buildFileTree(childLocalPath, childS3Key))
      }
   }

   return node
}

async function uploadFilesInParallel(
   files: FileTreeNode[],
   concurrency: number = 5
): Promise<void> {
   let uploadedFiles = 0
   const totalNumberFiles = files.length

   async function uploadedSingleFile(file: FileTreeNode): Promise<void> {
      const fileContent = fs.readFileSync(file.localPath)
      const contentType = mime.lookup(file.localPath) || 'application/octet-stream'

      await s3Client.send(new PutObjectCommand({
         Bucket: configEnv.MINIO_BUCKET,
         Key: file.s3Key,
         Body: fileContent,
         ContentType: contentType
      }))

      uploadedFiles++
      const uploadedPercent = Math.round((uploadedFiles / totalNumberFiles) * 100)
      logPublisher.publish(`Uploaded (${uploadedFiles}/${totalNumberFiles} - ${uploadedPercent}%): ${file.s3Key}`, { type: 'info', status: 'uploading' })
   }

   for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency)
      await Promise.all(batch.map(file => uploadedSingleFile(file)))
   }
}

async function ensureBucketExists(): Promise<void> {
   try {
      await s3Client.send(new HeadBucketCommand({ Bucket: configEnv.MINIO_BUCKET }))
      logPublisher.publish(`Bucket ${configEnv.MINIO_BUCKET} exists`, { type: 'info', status: 'idle' })
   } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
         logPublisher.publish(`Creating bucket ${configEnv.MINIO_BUCKET}...`, { type: 'info', status: 'building' })
         await s3Client.send(new CreateBucketCommand({ Bucket: configEnv.MINIO_BUCKET }))
         logPublisher.publish(`Bucket ${configEnv.MINIO_BUCKET} created`, { type: 'info', status: 'success' })
      } else {
         logPublisher.publish(`Error checking bucket ${configEnv.MINIO_BUCKET}: ${error.message}`, { type: 'error', status: 'error' })
         throw error
      }
   }
}

async function init(): Promise<void> {
   console.log('Executing script.ts')
   logPublisher.publish('Build Started...', { type: 'status', status: 'building' })

   await ensureBucketExists()

   const outDirPath = '/home/app/output'
   const p: ChildProcess = exec(`cd ${outDirPath} && npm install && npm run build`)

   p.stdout?.on('data', (data: Buffer) => {
      console.log(data.toString())
      logPublisher.publish(data.toString(), { type: 'info', status: 'building' })
   })

   p.stderr?.on('data', (data) => {
      console.log('Error', data.toString())
      logPublisher.publish(`error: ${data.toString()}`, { type: 'error', status: 'error' })
   })

   p.on('close', async (code: number | null) => {
      if (code !== 0) {
         console.log(`Build failed with code ${code}`)
         logPublisher.publish(`Build failed with exit code ${code}`, { type: 'error', status: 'error' })
         process.exit(1)
      }

      console.log('Build Complete')
      logPublisher.publish(`Build Complete`, { type: 'info', status: 'success' })

      const distFolderPath = path.join(outDirPath, 'dist')

      if (!fs.existsSync(distFolderPath)) {
         console.error('Dist folder not found!')
         logPublisher.publish('Error: Dist folder not found!', { type: 'error', status: 'error' })
         process.exit(1)
      }

      logPublisher.publish(`Scanning build output...`, { type: 'info', status: 'uploading' })

      try {
         const s3Prefix = `__outputs/${configEnv.PROJECT_ID}`

         const fileTree = buildFileTree(distFolderPath, s3Prefix)

         const stats = collectTreeStats(fileTree)

         logPublisher.publish(
            `Found ${stats.files.length} files (${formatBytes(stats.totalSize)}) in ${stats.directoryCount} directories`,
            { type: 'info', status: 'uploading' }
         )

         await uploadFilesInParallel(stats.files, 5)

         logPublisher.publish(`Files uploaded successfully to MinIO: ${s3Prefix}`, { type: 'info', status: 'success' })
         console.log(`Files uploaded successfully to MinIO: ${s3Prefix}`)
         logPublisher.publish(`Finished.`, { type: 'status', status: 'success' })
         console.log('Finished.')

         process.exit(0)
      } catch (error: any) {
         console.error('Error uploading files:', error)
         logPublisher.publish(`Error uploading files: ${error.message}`, { type: 'error', status: 'error' })
         process.exit(1)
      }
   })
}

init()