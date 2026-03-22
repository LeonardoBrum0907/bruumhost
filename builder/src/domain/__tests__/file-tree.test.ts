import { collectTreeStats, FileTreeNode } from "../file-tree"

describe('collectTreeStats', () => {
   it('return the correct files, totalSize and directoryCount', () => {
      const root: FileTreeNode = {
         name: 'dist',
         localPath: '/dist',
         s3Key: '__outputs/p1',
         isDirectory: true,
         size: 0,
         children: [
            {
               name: 'a.js',
               localPath: '/dist/a.js',
               s3Key: '__outputs/p1/a.js',
               isDirectory: false,
               size: 1000,
               children: []
            },
            {
               name: 'sub',
               localPath: '/dist/sub',
               s3Key: '__outputs/p1/sub',
               isDirectory: true,
               size: 0,
               children: [
                  {
                     name: 'b.css',
                     localPath: '/dist/sub/b.css',
                     s3Key: '__outputs/p1/sub/b.css',
                     isDirectory: false,
                     size: 500,
                     children: []
                  }
               ]
            }
         ]
      }

      const stats = collectTreeStats(root)

      expect(stats.files).toHaveLength(2)
      expect(stats.totalSize).toBe(1500)
      expect(stats.directoryCount).toBe(2)
   })
})