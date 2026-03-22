import { LogPublisher } from "@/application/ports/log-publisher"
import { ObjectStorage } from "@/application/ports/object-storage"
import { BuildRunner } from "@/application/ports/build-runner"
import { collectTreeStats, FileTreeNode } from "@/domain/file-tree"
import path from "path"
import { uploadArtifactsInParallel } from "./upload-artifacts-in-parallel"

export interface DeployConfig {
   projectId: string
   minioBucket: string
   outputDir: string
   distDirName: string
   uploadConcurrency: number
}

interface RunDeployPipelineDeps {
   config: DeployConfig
   logPublisher: LogPublisher
   objectStorage: ObjectStorage
   buildRunner: BuildRunner
   buildFileTree: (localPath: string, s3Prefix: string) => FileTreeNode
   existsPath: (path: string) => boolean
   readFile: (localPath: string) => Promise<Buffer>
   detectContentType: (localPath: string) => string
   formatBytes: (bytes: number) => string
}

function toErrorMessage(error: unknown): string {
   return error instanceof Error ? error.message : String(error)
}

export async function runDeployPipeline(deps: RunDeployPipelineDeps): Promise<{ exitCode: number }> {
   const { config, logPublisher } = deps

   try {
      logPublisher.publish(
         'Build Started...',
         { type: 'status', status: 'building' }
      )

      await deps.objectStorage.ensureBucket(config.minioBucket)

      const buildResult = await deps.buildRunner.run({ cwd: config.outputDir })
      if (buildResult.exitCode !== 0) {
         logPublisher.publish(
            `Build failed with exit code ${buildResult.exitCode}`,
            { type: 'error', status: 'error' }
         )
         return { exitCode: 1 }
      }

      logPublisher.publish(
         'Build Complete!',
         { type: 'info', status: 'success' }
      )

      const distFolderPath = path.join(config.outputDir, config.distDirName)
      if (!deps.existsPath(distFolderPath)) {
         logPublisher.publish(
            `Error: ${config.distDirName} folder not found!`,
            { type: 'error', status: 'error' }
         )
         return { exitCode: 1 }
      }

      logPublisher.publish(
         'Scanning build output...',
         { type: 'info', status: 'uploading' }
      )
      logPublisher.publish(
         `Upload concurrency: ${config.uploadConcurrency}`,
         { type: 'info', status: 'uploading' }
      )

      const s3Prefix = `__outputs/${config.projectId}`
      const fileTree = deps.buildFileTree(distFolderPath, s3Prefix)
      const stats = collectTreeStats(fileTree)

      logPublisher.publish(
         `Found ${stats.files.length} files (${deps.formatBytes(stats.totalSize)}) in ${stats.directoryCount} directories`,
         { type: 'info', status: 'uploading' }
      )

      await uploadArtifactsInParallel(stats.files, {
         objectStorage: deps.objectStorage,
         logPublisher: deps.logPublisher,
         readFile: deps.readFile,
         detectContentType: deps.detectContentType,
         concurrency: config.uploadConcurrency
      })

      logPublisher.publish(
         'Files uploaded successfully!',
         { type: 'info', status: 'success' }
      )
      logPublisher.publish(
         'Finished.',
         { type: 'status', status: 'success' }
      )

      return { exitCode: 0 }
   } catch (error: unknown) {
      logPublisher.publish(
         `Error uploading files: ${toErrorMessage(error)}`, 
         { type: 'error', status: 'error' }
      )
      return { exitCode: 1 }
   }
}