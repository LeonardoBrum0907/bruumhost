export interface EnvConfig {
   DOCKER_SOCKET: string
   REDIS_URL: string
   MINIO_ENDPOINT: string
   MINIO_ACCESS_KEY: string
   MINIO_SECRET_KEY: string
   MINIO_BUCKET: string
   BUILD_IMAGE_NAME: string
   DOCKER_NETWORK: string
   REVERSE_PROXY_DOMAIN: string
   USE_HTTPS: boolean
   TTL_MINUTES: number
}

export function readEnv(env: NodeJS.ProcessEnv): EnvConfig {
   return {
      DOCKER_SOCKET: env.DOCKER_SOCKET || '/var/run/docker.sock',
      REDIS_URL: env.REDIS_URL!,
      MINIO_ENDPOINT: env.MINIO_ENDPOINT!,
      MINIO_ACCESS_KEY: env.MINIO_ACCESS_KEY!,
      MINIO_SECRET_KEY: env.MINIO_SECRET_KEY!,
      MINIO_BUCKET: env.MINIO_BUCKET!,
      BUILD_IMAGE_NAME: env.BUILD_IMAGE_NAME!,
      DOCKER_NETWORK: env.DOCKER_NETWORK!,
      REVERSE_PROXY_DOMAIN: env.REVERSE_PROXY_DOMAIN || "localhost",
      USE_HTTPS: env.USE_HTTPS !== "false",
      TTL_MINUTES: parseInt(env.TTL_MINUTES || "60", 10),
   }
}