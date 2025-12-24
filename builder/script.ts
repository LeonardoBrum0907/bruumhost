import { exec, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import mime from 'mime-types'
import Redis from 'ioredis'
import dotenv from 'dotenv'
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

dotenv.config()

type LogType = 'status' | 'error' | 'warning' | 'info' | 'debug'
type DeplyStatus = 'idle' | 'building' | 'uploading' | 'success' | 'error'

interface LogMessage {
   log: string
   type?: LogType
   status?: DeplyStatus
   timestamp?: number
}

const REDIS_URL = process.env.REDIS_URL!
const PROJECT_ID = process.env.PROJECT_ID!
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT!
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY!
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY!
const MINIO_BUCKET = process.env.MINIO_BUCKET!

const publisher = new Redis(REDIS_URL)

const s3Client = new S3Client({
   endpoint: MINIO_ENDPOINT,
   region: 'us-east-1',
   credentials: {
    accessKeyId: MINIO_ACCESS_KEY,
    secretAccessKey: MINIO_SECRET_KEY
   },
   forcePathStyle: true
})

function publishLog(log: string, metadata?: { type?: LogType, status?: DeplyStatus }): void {
   const message: LogMessage = {
      log,
      type: metadata?.type,
      status: metadata?.status,
      timestamp: Date.now()
   }
   publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify(message))
}

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
            Bucket: MINIO_BUCKET,
            Key: s3Key,
            Body: fileContent,
            ContentType: contentType
         }

         try {
            await s3Client.send(new PutObjectCommand(objectParams))
            publishLog(`Uploaded: ${s3Key}`, { type: 'info', status: 'uploading' })
         } catch (error: any) {
            console.error(`Error uploading ${s3Key}:`, error)
            publishLog(`Error uploading ${s3Key}: ${error.message}`, { type: 'error', status: 'error' })
            throw error
         }
      }
   }
}

async function ensureBucketExists(): Promise<void> {
   try {
      await s3Client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }))
      publishLog(`Bucket ${MINIO_BUCKET} exists`, { type: 'info', status: 'idle' })
   } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
         publishLog(`Creating bucket ${MINIO_BUCKET}...`, { type: 'info', status: 'building' })
         await s3Client.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }))
         publishLog(`Bucket ${MINIO_BUCKET} created`, { type: 'info', status: 'success' })
      } else {
         publishLog(`Error checking bucket ${MINIO_BUCKET}: ${error.message}`, { type: 'error', status: 'error' })
         throw error
      }
   }
}

async function init(): Promise<void> {
   console.log('Executing script.ts')
   publishLog('Build Started...', { type: 'status', status: 'building' })

   await ensureBucketExists()

   // const outDirPath = path.join(__dirname, 'output')
   const outDirPath = '/home/app/output'
   const p: ChildProcess = exec(`cd ${outDirPath} && npm install && npm run build`)

   p.stdout?.on('data', (data: Buffer) => {
      console.log(data.toString())
      publishLog(data.toString(), { type: 'info', status: 'building' })
   })

   p.stderr?.on('data', (data) => {
      console.log('Error', data.toString())
      publishLog(`error: ${data.toString()}`, { type: 'error', status: 'error' })
   })

   p.on('close', async (code: number | null) => {
      if (code !== 0) {
         console.log(`Build failed with code ${code}`)
         publishLog(`Build failed with exit code ${code}`, { type: 'error', status: 'error' })
         process.exit(1)
      }

      console.log('Build Complete')
      publishLog(`Build Complete`, { type: 'info', status: 'success' })

      const distFolderPath = path.join(outDirPath, 'dist')

      if (!fs.existsSync(distFolderPath)) {
         console.error('Dist folder not found!')
         publishLog('Error: Dist folder not found!', { type: 'error', status: 'error' })
         process.exit(1)
      }

      publishLog(`Starting to upload files to MinIO`, { type: 'info', status: 'uploading' })

      try {
         const s3Prefix = `__outputs/${PROJECT_ID}`
         await uploadDirectoryToMinIO(distFolderPath, s3Prefix)

         publishLog(`Files uploaded successfully to MinIO: ${s3Prefix}`, { type: 'info', status: 'success' })
         console.log(`Files uploaded successfully to MinIO: ${s3Prefix}`)
         publishLog(`Finished.`, { type: 'status', status: 'success' })
         console.log('Finished.')

         process.exit(0)
      } catch (error: any) {
         console.error('Error uploading files:', error)
         publishLog(`Error uploading files: ${error.message}`, { type: 'error', status: 'error' })
         process.exit(1)
      }
   })
}

init()