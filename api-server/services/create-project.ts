interface CreateProjectInput {
   githubURL: string
   slug?: string
}

interface CreateProjectOutput {
   projectSlug: string
   previewURL: string
}

interface DockerOptions {
   Image: string
   name: string
   Env: string[]
   HostConfig: {
     AutoRemove: boolean
     NetworkMode: string
   }
   AttachStdout: boolean
   AttachStderr: boolean
}

interface DockerClientPort {
   createContainer(options: DockerOptions): Promise<{ start: () => Promise<void> }>
}

interface RedisPort {
   set(
      key: string,
      value: string,
      mode: 'EX',
      ttlSeconds: number
   ): Promise<string>
}

interface EnvConfig {
   REDIS_URL: string;
   MINIO_ENDPOINT: string;
   MINIO_ACCESS_KEY: string;
   MINIO_SECRET_KEY: string;
   MINIO_BUCKET: string;
   BUILD_IMAGE_NAME: string;
   DOCKER_NETWORK: string;
   REVERSE_PROXY_DOMAIN: string;
   USE_HTTPS: boolean;
   TTL_MINUTES: number;
}

interface CreateProjectDeps {
   docker: DockerClientPort
   redis: RedisPort
   ensureImageExists: (imageName: string) => Promise<void>
   generateSlug: () => string
   dateNow: () => number
   env: EnvConfig
}

export async function createProject(
   { githubURL, slug }: CreateProjectInput,
   deps: CreateProjectDeps
): Promise<CreateProjectOutput> {
   const {
      docker,
      redis,
      ensureImageExists,
      generateSlug,
      env
   } = deps

   const dateNow = deps.dateNow()

   const projectSlug = slug ?? generateSlug()

   await ensureImageExists(env.BUILD_IMAGE_NAME)

   const container = await docker.createContainer({
      Image: env.BUILD_IMAGE_NAME,
      name: `build-${projectSlug}-${dateNow}`,
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

   const createdAt = dateNow
   const expiresAt = createdAt + env.TTL_MINUTES * 60 * 1000

   await redis.set(
      `project:${projectSlug}`,
      JSON.stringify({
         slug: projectSlug,
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