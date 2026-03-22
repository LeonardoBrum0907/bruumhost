import { FileTreeNode } from "@/domain/file-tree";
import fs from "fs";
import path from "path"

export function buildFileTree(localPath: string, s3Prefix: string): FileTreeNode {
   const name = path.basename(localPath)
   const stat = fs.lstatSync(localPath)

   const node: FileTreeNode = {
      name,
      localPath,
      s3Key: s3Prefix.replace(/\\/g, '/'),
      isDirectory: stat.isDirectory(),
      size: stat.isDirectory() ? 0 : stat.size,
      children: []
   }

   if (stat.isDirectory()) {
      const entries = fs.readdirSync(localPath)
      for (const entry of entries) {
         const childLocalPath = path.join(localPath, entry)
         const childS3Key = path.join(s3Prefix, entry).replace(/\\/g, '/')
         node.children.push(buildFileTree(childLocalPath, childS3Key))
      }
   }

    return node
}