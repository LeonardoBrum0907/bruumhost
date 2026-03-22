import { EnvConfig } from "../../core/env"
import { ClockPort, DockerClientPort, DockerCreateContainerOptions, ImageCheckerPort, RedisPort } from "../../core/ports"
import { CreateProjectDeps } from "../../services/create-project"

export function makeDockerClientMock() {
   const start = jest.fn<Promise<void>, []>(() => Promise.resolve())
   const createContainer = jest.fn<Promise<{ start: () => Promise<void> }>, [DockerCreateContainerOptions]>(async () => ({ start }))
   const docker: DockerClientPort = { createContainer }
   return { docker, createContainer, start }
}

export function makeRedisMock() {
   const set = jest.fn<Promise<string>, [string, string, 'EX', number]>(() => Promise.resolve('OK'))
   const redis: RedisPort = { set }
   return { redis, set }
}

export function makeImageCheckerMock() {
   const ensureImageExists = jest.fn<Promise<void>, [string]>(() => Promise.resolve())
   const imageChecker: ImageCheckerPort = { ensureImageExists }
   return { imageChecker, ensureImageExists }
}

export function makeClockMock(fixedNow: number) {
   const now = jest.fn<ReturnType<ClockPort['now']>, []>(() => fixedNow)
   const clock: ClockPort = { now }
   return { clock, now }
}

export function makeEnvConfig(overrides: Partial<EnvConfig> = {}): EnvConfig {
   return {
      DOCKER_SOCKET: '/var/run/docker.sock',
      REDIS_URL: 'redis://localhost:6379',
      MINIO_ENDPOINT: 'http://minio:9000',
      MINIO_ACCESS_KEY: 'test-access',
      MINIO_SECRET_KEY: 'test-secret',
      MINIO_BUCKET: 'test-bucket',
      BUILD_IMAGE_NAME: 'builder:latest',
      DOCKER_NETWORK: 'test-network',
      REVERSE_PROXY_DOMAIN: 'localhost',
      USE_HTTPS: false,
      TTL_MINUTES: 60,
      UPLOAD_CONCURRENCY: 5,
      ...overrides,
   }
}

export function makeCreateProjectDeps(
   overrides?: Partial<CreateProjectDeps>,
   fixedNow = 1700000000000
): { deps: CreateProjectDeps } &
   ReturnType<typeof makeDockerClientMock> &
   ReturnType<typeof makeRedisMock> &
   ReturnType<typeof makeImageCheckerMock> &
   ReturnType<typeof makeClockMock> {
   const { docker, createContainer, start } = makeDockerClientMock()
   const { redis, set } = makeRedisMock()
   const { imageChecker, ensureImageExists } = makeImageCheckerMock()
   const { clock, now } = makeClockMock(fixedNow)
   const env = makeEnvConfig()

   const generateSlug = jest.fn(() => 'generated-slug')

   const deps: CreateProjectDeps = {
      docker,
      redis,
      imageChecker,
      clock,
      generateSlug,
      env,
      ...overrides
   }

   return {
      deps,
      docker,
      createContainer,
      start,
      redis,
      set,
      imageChecker,
      ensureImageExists,
      clock,
      now,
   }
}

