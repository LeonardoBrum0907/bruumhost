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
import { S3ObjectStorage } from '@/infrastructure/s3-object-storage'
import { buildFileTree } from '@/infrastructure/file-tree-scanner'
import { uploadArtifactsInParallel } from '@/application/use-cases/upload-artifacts-in-parallel'
import { detectContentType } from '@/infrastructure/utils/content-type'
import { readFileFromDisk } from '@/infrastructure/node-file-reader'

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

const objectStorage = new S3ObjectStorage(s3Client, configEnv.MINIO_BUCKET)

async function init(): Promise<void> {
   console.log('Build Started...')
   logPublisher.publish('Build Started...', { type: 'status', status: 'building' })

   await objectStorage.ensureBucket(configEnv.MINIO_BUCKET)

   const outDirPath = '/home/app/output'
   const p: ChildProcess = exec(`cd ${outDirPath} && npm install && npm run build`)

   p.stdout?.on('data', (data: Buffer) => {
      console.log(data.toString())
      logPublisher.publish(`Build: ${data.toString()}`, { type: 'info', status: 'building' })
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

         await uploadArtifactsInParallel(stats.files, {
            objectStorage,
            logPublisher,
            readFile: readFileFromDisk,
            detectContentType,
            concurrency: configEnv.UPLOAD_CONCURRENCY
         })

         logPublisher.publish(`Files uploaded successfully to MinIO: ${s3Prefix}`, { type: 'info', status: 'success' })
         logPublisher.publish(`Finished.`, { type: 'status', status: 'success' })
         process.exit(0)
      } catch (error: any) {
         console.error('Error uploading files:', error)
         logPublisher.publish(`Error uploading files: ${error.message}`, { type: 'error', status: 'error' })
         process.exit(1)
      }
   })
}

init()