import Redis from 'ioredis'
import dotenv from 'dotenv'
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'

dotenv.config()

const REDIS_URL = process.env.REDIS_URL!
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT!
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY!
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY!
const TTL_HOURS = parseInt(process.env.TTL_HOURS || '24')
const MINIO_BUCKET = process.env.MINIO_BUCKET!

const redis = new Redis(REDIS_URL)
const s3Client = new S3Client({
   endpoint: MINIO_ENDPOINT,
   region: 'us-east-1',
   credentials: {
      accessKeyId: MINIO_ACCESS_KEY,
      secretAccessKey: MINIO_SECRET_KEY
   },
   forcePathStyle: true
})

interface ProjectInfo {
   slug: string
   createdAt: number
}

export async function cleanupExpiredProjects(): Promise<void> {
   const now = Date.now()
   const cutoff = now - (TTL_HOURS * 60 * 60 * 1000)

   const keys = await redis.keys('project:*')

   for (const key of keys) {
      const data = await redis.get(key)
      if(!data) continue

      const project: ProjectInfo = JSON.parse(data)
      if (project.createdAt < cutoff) {
         console.log(`Deleting expired project: ${project.slug}`)

         await deleteMinIOFiles(project.slug)
         await redis.del(key)
      }
   }
}

async function deleteMinIOFiles(projectSlug: string): Promise<void> {
   const prefix = `__outputs/${projectSlug}/`
   const objects = await s3Client.send(new ListObjectsV2Command({
      Bucket: MINIO_BUCKET,
      Prefix: prefix
   }))

   if (objects.Contents?.length) {
      await s3Client.send(new DeleteObjectsCommand({
         Bucket: MINIO_BUCKET,
         Delete: {
            Objects: objects.Contents.map(obj => ({ Key: obj.Key }))
         }
      }))
   }
}