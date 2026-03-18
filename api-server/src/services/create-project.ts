import type { EnvConfig } from "../core/env"
import type { ClockPort, DockerClientPort, ImageCheckerPort, RedisPort } from "../core/ports"

interface CreateProjectInput {
   githubURL: string
   slug?: string
}

interface CreateProjectOutput {
   projectSlug: string
   previewURL: string
}

interface CreateProjectDeps {
   docker: DockerClientPort
   redis: RedisPort
   imageChecker: ImageCheckerPort
   clock: ClockPort
   generateSlug: () => string
   env: EnvConfig
}

export async function createProject(
   { githubURL, slug }: CreateProjectInput,
   deps: CreateProjectDeps
): Promise<CreateProjectOutput> {
   const {
      docker,
      redis,
      imageChecker,
      clock,
      generateSlug,
      env
   } = deps

   
   const projectSlug = slug ?? generateSlug()
   
   await imageChecker.ensureImageExists(env.BUILD_IMAGE_NAME)
   
   const now = clock.now()

   const container = await docker.createContainer({
      Image: env.BUILD_IMAGE_NAME,
      name: `build-${projectSlug}-${now}`,
      Env: [
         `GITHUB_REPOSITORY_URL=${githubURL}`,
         `PROJECT_ID=${projectSlug}`,
         `REDIS_URL=${env.REDIS_URL}`,
         `MINIO_ENDPOINT=${env.MINIO_ENDPOINT}`,
         `MINIO_ACCESS_KEY=${env.MINIO_ACCESS_KEY}`,
         `MINIO_SECRET_KEY=${env.MINIO_SECRET_KEY}`,
         `MINIO_BUCKET=${env.MINIO_BUCKET}`,
      ],
      HostConfig: {
         AutoRemove: true,
         NetworkMode: env.DOCKER_NETWORK,
      },
      AttachStdout: true,
      AttachStderr: true,
   })

   await container.start()

   const protocol = env.USE_HTTPS ? 'https' : 'http'
   const previewURL = `${protocol}://${projectSlug}.${env.REVERSE_PROXY_DOMAIN}${env.USE_HTTPS ? '' : ':8000'}`

   const createdAt = now
   const expiresAt = createdAt + env.TTL_MINUTES * 60 * 1000

   await redis.set(
      `project:${projectSlug}`,
      JSON.stringify({
         projectSlug,
         githubURL,
         createdAt,
         expiresAt
      }),
      'EX',
      (env.TTL_MINUTES * 3) * 60
   )

   return {
      projectSlug,
      previewURL
   }
}