export interface BuilderEnvConfig {
   REDIS_URL: string
   PROJECT_ID: string
   MINIO_ENDPOINT: string
   MINIO_ACCESS_KEY: string
   MINIO_SECRET_KEY: string
   MINIO_BUCKET: string
   OUTPUT_DIR: string
   DIST_DIR_NAME: string
   UPLOAD_CONCURRENCY: number
}

function requiredEnv(env: NodeJS.ProcessEnv, key: string): string {
   const v = env[key]?.trim()
   if (!v) throw new Error(`Environment variable ${key} is required`)
   return v
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
   if (!raw?.trim()) return fallback
   const parsed = Number.parseInt(raw, 10)
   if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error('Environment variable UPLOAD_CONCURRENCY must be a positive integer')
   }
   return parsed
}

export function readBuilderEnv(env: NodeJS.ProcessEnv = process.env): BuilderEnvConfig {
   return {
      REDIS_URL: requiredEnv(env, 'REDIS_URL'),
      PROJECT_ID: requiredEnv(env, 'PROJECT_ID'),
      MINIO_ENDPOINT: requiredEnv(env, 'MINIO_ENDPOINT'),
      MINIO_ACCESS_KEY: requiredEnv(env, 'MINIO_ACCESS_KEY'),
      MINIO_SECRET_KEY: requiredEnv(env, 'MINIO_SECRET_KEY'),
      MINIO_BUCKET: requiredEnv(env, 'MINIO_BUCKET'),
      OUTPUT_DIR: env.OUTPUT_DIR?.trim() || '/home/app/output',
      DIST_DIR_NAME: env.DIST_DIR_NAME?.trim() || 'dist',
      UPLOAD_CONCURRENCY: parsePositiveInt(env.UPLOAD_CONCURRENCY, 5)
   }
}