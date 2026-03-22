import { FileTreeNode } from "@/domain/file-tree";
import { DeployConfig, runDeployPipeline } from "../use-cases/run-deploy-pipeline";

function createFileTree(): FileTreeNode {
   return {
      name: 'dist',
      localPath: '/out/dist',
      s3Key: '__outputs/p1',
      isDirectory: true,
      size: 0,
      children: [
         {
            name: 'index.html',
            localPath: '/out/dist/index.html',
            s3Key: '__outputs/p1/index.html',
            isDirectory: false,
            size: 10,
            children: []
         }
      ]
   }
}

describe('runDeployPipeline', () => {
   const baseConfig: DeployConfig = {
      projectId: 'p1',
      minioBucket: 'bucket',
      outputDir: '/out',
      distDirName: 'dist',
      uploadConcurrency: 3
   }

   it('happy flow return exitCode 0', async () => {
      const logPublisher = { publish: jest.fn() }
      const objectStorage = {
         ensureBucket: jest.fn(async () => {}),
         uploadFile: jest.fn(async () => {})
      }
      const buildRunner = {
         run: jest.fn(async () => ({ exitCode: 0 }))
      }

      const result = await runDeployPipeline({
         config: baseConfig,
         logPublisher,
         objectStorage,
         buildRunner,
         buildFileTree: () => createFileTree(),
         existsPath: () => true,
         readFile: async () => Buffer.from('ok'),
         detectContentType: () => 'text/html',
         formatBytes: (b) => `${b} B`
      })

      expect(result.exitCode).toBe(0)
      expect(objectStorage.ensureBucket).toHaveBeenCalledWith('bucket')
      expect(buildRunner.run).toHaveBeenCalledWith({ cwd: '/out' })
      expect(objectStorage.uploadFile).toHaveBeenCalledTimes(1)
   })

   it('build failure returns exitCode 1 and skips upload', async () => {
      const logPublisher = { publish: jest.fn() }
      const objectStorage = {
         ensureBucket: jest.fn(async () => {}),
         uploadFile: jest.fn(async () => {})
      }
      const buildRunner = {
         run: jest.fn(async () => ({ exitCode: 1 }))
      }
      const buildFileTree = jest.fn()

      const result = await runDeployPipeline({
         config: baseConfig,
         logPublisher,
         objectStorage,
         buildRunner,
         buildFileTree,
         existsPath: () => true,
         readFile: async () => Buffer.from('ok'),
         detectContentType: () => 'text/plain',
         formatBytes: (b) => `${b} B`
      })

      expect(result.exitCode).toBe(1)
      expect(buildFileTree).not.toHaveBeenCalled()
      expect(objectStorage.uploadFile).not.toHaveBeenCalled()
   })
})