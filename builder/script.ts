import { exec, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import mime from 'mime-types'
import Redis from 'ioredis'
import dotenv from 'dotenv'
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

dotenv.config()

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

function publishLog(log: string): void {
   publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }))
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
            publishLog(`Uploaded: ${s3Key}`)
         } catch (error: any) {
            console.error(`Error uploading ${s3Key}:`, error)
            publishLog(`Error uploading ${s3Key}: ${error.message}`)
            throw error
         }
      }
   }
}

async function ensureBucketExists(): Promise<void> {
   try {
      await s3Client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }))
      publishLog(`Bucket ${MINIO_BUCKET} exists`)
   } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
         publishLog(`Creating bucket ${MINIO_BUCKET}...`)
         await s3Client.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }))
         publishLog(`Bucket ${MINIO_BUCKET} created`)
      } else {
         publishLog(`Error checking bucket ${MINIO_BUCKET}: ${error.message}`)
         throw error
      }
   }
}

async function init(): Promise<void> {
   console.log('Executing script.ts')
   publishLog('Build Started...')

   await ensureBucketExists()

   const outDirPath = path.join(__dirname, 'output')
   const p: ChildProcess = exec(`cd ${outDirPath} && npm install && npm run build`)

   p.stdout?.on('data', (data: Buffer) => {
      console.log(data.toString())
      publishLog(data.toString())
   })

   p.stderr?.on('data', (data) => {
      console.log('Error', data.toString())
      publishLog(`error: ${data.toString()}`)
   })

   p.on('close', async (code: number | null) => {
      if (code !== 0) {
         console.log(`Build failed with code ${code}`)
         publishLog(`Build failed with exit code ${code}`)
         process.exit(1)
      }

      console.log('Build Complete')
      publishLog(`Build Complete`)

      const distFolderPath = path.join(outDirPath, 'dist')

      if (!fs.existsSync(distFolderPath)) {
         console.error('Dist folder not found!')
         publishLog('Error: Dist folder not found!')
         process.exit(1)
      }

      publishLog(`Starting to upload files to MinIO`)

      try {
         const s3Prefix = `__outputs/${PROJECT_ID}`
         await uploadDirectoryToMinIO(distFolderPath, s3Prefix)

         publishLog(`Files uploaded successfully to MinIO: ${s3Prefix}`)
         console.log(`Files uploaded successfully to MinIO: ${s3Prefix}`)
         publishLog(`Finished.`)
         console.log('Finished.')

         process.exit(0)
      } catch (error: any) {
         console.error('Error uploading files:', error)
         publishLog(`Error uploading files: ${error.message}`)
         process.exit(1)
      }
   })
}

init()