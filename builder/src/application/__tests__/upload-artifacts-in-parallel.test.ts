import { FileTreeNode } from "@/domain/file-tree"
import { uploadArtifactsInParallel } from "../use-cases/upload-artifacts-in-parallel"

describe('uploadArtifactsInParallel', () => {
   it('respects the concurrency limit and uploads all files', async () => {
      const files: FileTreeNode[] = Array.from({ length: 10 }, (_, i) => ({
         name: `f${i}.txt`,
         localPath: `/tmp/f${i}.txt`,
         s3Key: `__outputs/p1/f${i}.txt`,
         isDirectory: false,
         size: 10,
         children: []
      }))

      let currentConcurrent = 0
      let maxConcurrent = 0
      let uploadCalls = 0

      const objectStorage = {
         ensureBucket: async () => {},
         uploadFile: async () => {
            uploadCalls++
            currentConcurrent++
            maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
            await new Promise((r) => setTimeout(r, 20))
            currentConcurrent--
         }
      }

      const logPublisher = { publish: jest.fn() }

      await uploadArtifactsInParallel(files, {
         objectStorage,
         logPublisher,
         readFile: async () => Buffer.from('x'),
         detectContentType: () => 'text/plain',
         concurrency: 3
      })

      expect(uploadCalls).toBe(10)
      expect(maxConcurrent).toBeLessThanOrEqual(3)
   })
})