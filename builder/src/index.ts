import { exec, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import mime from 'mime-types'
import Redis from 'ioredis'
import dotenv from 'dotenv'
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { readBuilderEnv } from './config/env'
import { LogType, DeployStatus, LogMessage } from './domain/messages'
import { LogPublisher } from './application/ports/log-publisher'
import { RedisLogPublisher } from './infrastructure/redis-log-publisher'

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

async function uploadDirectoryToMinIO(localPath: string, s3Prefix: string): Promise<void> {
   const files = fs.readdirSync(localPath)

   for (const file of files) {
      const filePath = path.join(localPath, file)
      const s3Key = path.join(s3Prefix, file).replace(/\\/g, '/')

      if (fs.lstatSync(filePath).isDirectory()) {
         await uploadDirectoryToMinIO(filePath, s3Key)
      } else {
         const fileContent = fs.readFileSync(filePath)
         const contentType = mime.lookup(filePath) || 'application/octet-stream'
         const objectParams = {
            Bucket: configEnv.MINIO_BUCKET,
            Key: s3Key,
            Body: fileContent,
            ContentType: contentType
         }

         try {
            await s3Client.send(new PutObjectCommand(objectParams))
            logPublisher.publish(`Uploaded: ${s3Key}`, { type: 'info', status: 'uploading' })
         } catch (error: any) {
            console.error(`Error uploading ${s3Key}:`, error)
            logPublisher.publish(`Error uploading ${s3Key}: ${error.message}`, { type: 'error', status: 'error' })
            throw error
         }
      }
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

   // const outDirPath = path.join(__dirname, 'output')
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

      logPublisher.publish(`Starting to upload files to MinIO`, { type: 'info', status: 'uploading' })

      try {
         const s3Prefix = `__outputs/${configEnv.PROJECT_ID}`
         await uploadDirectoryToMinIO(distFolderPath, s3Prefix)

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