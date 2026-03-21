export interface FileTreeNode {
   name: string
   localPath: string
   s3Key: string
   isDirectory: boolean
   size: number
   children: FileTreeNode[]
}

export interface TreeStats {
   files: FileTreeNode[]
   totalSize: number
   directoryCount: number
}

export function collectTreeStats(root: FileTreeNode): TreeStats {
   const files: FileTreeNode[] = []
   let totalSize = 0
   let directoryCount = 0

   function dfs(node: FileTreeNode): void {
      if (node.isDirectory) {
         directoryCount++
         for (const child of node.children) {
            dfs(child)
         }
      } else {
         files.push(node)
         totalSize += node.size
      }
   }

   dfs(root)
   
   return {
      files,
      totalSize,
      directoryCount
   }
}