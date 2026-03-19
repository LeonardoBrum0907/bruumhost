import { createProject } from "../services/create-project"
import { makeCreateProjectDeps } from "../tests/helpers/test-deps"

describe('createProject', () => {
   it('should create the container, start it, persist in Redis, and return slug + URL', async () => {
      const FIXED_NOW = 1700000000000

      const {
         deps,
         createContainer,
         start,
         set,
         ensureImageExists,
         now
      } = makeCreateProjectDeps(undefined, FIXED_NOW)

      const githubURL = 'https://github.com/org/repo'

      const result = await createProject({ githubURL }, deps)

      expect(deps.generateSlug).toHaveBeenCalledTimes(1)
      const slug = (deps.generateSlug as jest.Mock).mock.results[0]?.value
      expect(result.projectSlug).toBe(slug)

      expect(ensureImageExists).toHaveBeenCalledTimes(1)
      expect(ensureImageExists).toHaveBeenCalledWith(deps.env.BUILD_IMAGE_NAME)
      expect(ensureImageExists.mock.invocationCallOrder[0]).toBeLessThan(
         createContainer.mock.invocationCallOrder[0]
      )

      expect(createContainer).toHaveBeenCalledTimes(1)
      const options = createContainer.mock.calls[0][0]


      expect(options.Image).toBe(deps.env.BUILD_IMAGE_NAME)
      expect(options.name).toBe(`build-${slug}-${FIXED_NOW}`)
      expect(options.HostConfig).toEqual({
         AutoRemove: true,
         NetworkMode: deps.env.DOCKER_NETWORK
      })
      expect(options.Env).toEqual(
         expect.arrayContaining([
            `GITHUB_REPOSITORY_URL=${githubURL}`,
            `PROJECT_ID=${slug}`,
            `REDIS_URL=${deps.env.REDIS_URL}`,
            `MINIO_ENDPOINT=${deps.env.MINIO_ENDPOINT}`,
            `MINIO_ACCESS_KEY=${deps.env.MINIO_ACCESS_KEY}`,
            `MINIO_SECRET_KEY=${deps.env.MINIO_SECRET_KEY}`,
            `MINIO_BUCKET=${deps.env.MINIO_BUCKET}`,
         ])
      )
      expect(options.AttachStdout).toBe(true)
      expect(options.AttachStderr).toBe(true)

      expect(start).toHaveBeenCalledTimes(1)

      expect(set).toHaveBeenCalledTimes(1)
      const [key, value, mode, ttlSeconds] = set.mock.calls[0]

      expect(key).toBe(`project:${slug}`)
      expect(mode).toBe('EX')
      expect(ttlSeconds).toBe(deps.env.TTL_MINUTES * 3 * 60)

      const parsed = JSON.parse(value)
      expect(parsed.slug ?? parsed.projectSlug).toBe(slug)
      expect(parsed.githubURL).toBe(githubURL)
      expect(parsed.createdAt).toBe(FIXED_NOW)
      expect(parsed.expiresAt).toBe(FIXED_NOW + deps.env.TTL_MINUTES * 60 * 1000)

      const protocol = deps.env.USE_HTTPS ? 'https' : 'http'
      const expectedURL = `${protocol}://${slug}.${deps.env.REVERSE_PROXY_DOMAIN}${deps.env.USE_HTTPS ? '' : ':8000'}`
      expect(result.previewURL).toBe(expectedURL)

      expect(now).toHaveBeenCalledTimes(1)
   })
})