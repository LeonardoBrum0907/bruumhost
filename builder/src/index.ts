import fs from 'fs'
import Redis from 'ioredis'
import dotenv from 'dotenv'
import { S3Client } from '@aws-sdk/client-s3'
import { readBuilderEnv } from '@/config/env'
import { LogPublisher } from '@/application/ports/log-publisher'
import { RedisLogPublisher } from '@/infrastructure/redis-log-publisher'
import { formatBytes } from '@/infrastructure/utils/formatters'
import { S3ObjectStorage } from '@/infrastructure/s3-object-storage'
import { buildFileTree } from '@/infrastructure/file-tree-scanner'
import { detectContentType } from '@/infrastructure/utils/content-type'
import { readFileFromDisk } from '@/infrastructure/node-file-reader'
import { ShellNpmBuildRunner } from '@/infrastructure/shell-npm-build-runner'
import { runDeployPipeline } from '@/application/use-cases/run-deploy-pipeline'

dotenv.config()

async function main(): Promise<void> {
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
   const buildRunner = new ShellNpmBuildRunner(logPublisher)

   const result = await runDeployPipeline({
      config: {
         projectId: configEnv.PROJECT_ID,
         minioBucket: configEnv.MINIO_BUCKET,
         outputDir: configEnv.OUTPUT_DIR,
         distDirName: configEnv.DIST_DIR_NAME,
         uploadConcurrency: configEnv.UPLOAD_CONCURRENCY
      },
      logPublisher,
      objectStorage,
      buildRunner,
      buildFileTree,
      existsPath: fs.existsSync,
      readFile: readFileFromDisk,
      detectContentType,
      formatBytes
   })

   process.exit(result.exitCode)
}

main().catch((error) => {
   console.error(error)
   process.exit(1)
})