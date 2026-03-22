import { FileTreeNode } from "@/domain/file-tree";
import { LogPublisher } from "../ports/log-publisher";
import { ObjectStorage } from "../ports/object-storage";

export interface UploadArtifactsDeps {
   objectStorage: ObjectStorage
   logPublisher: LogPublisher
   readFile: (localPath: string) => Promise<Buffer>
   detectContentType: (localPath: string) => string
   concurrency: number
}

export async function uploadArtifactsInParallel(
   files: FileTreeNode[],
   deps: UploadArtifactsDeps
): Promise<void> {
   if (files.length === 0) return

   const concurrency = Math.max(1, deps.concurrency)
   let uploadedFiles = 0
   const totalNumberFiles = files.length

   for (let i = 0; i < totalNumberFiles; i += concurrency) {
      const batch = files.slice(i, i + concurrency)

      await Promise.all(
         batch.map(async (file) => {
            const body = await deps.readFile(file.localPath)
            const contentType = deps.detectContentType(file.localPath)

            await deps.objectStorage.uploadFile(file.s3Key, body, contentType)

            uploadedFiles++
            const uploadedPercent = Math.round((uploadedFiles / totalNumberFiles) * 100)
            deps.logPublisher.publish(
               `Uploaded (${uploadedFiles}/${totalNumberFiles} - ${uploadedPercent}%): ${file.s3Key}`,
               { type: 'info', status: 'uploading' }
            )
         })
      )
   }
}