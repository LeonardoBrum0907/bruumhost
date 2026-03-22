import fs from 'fs'
import os from 'os'
import path from 'path'
import { buildFileTree } from '../file-tree-scanner'

describe('buildFileTree', () => {
   let tmpDir: string

   beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'builder-tree-'))
      fs.mkdirSync(path.join(tmpDir, 'sub'))
      fs.writeFileSync(path.join(tmpDir, 'file1.txt'), 'hello')
      fs.writeFileSync(path.join(tmpDir, 'sub', 'file2.txt'), 'world')
   })

   afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true })
   })

   it('builds the tree with the correct hierarchy and sizes', () => {
      const tree = buildFileTree(tmpDir, '__outputs/p1')

      expect(tree.isDirectory).toBe(true)
      expect(tree.children.length).toBe(2)

      const file1 = tree.children.find((c) => c.name === 'file1.txt')
      const sub = tree.children.find((c) => c.name === 'sub')

      expect(file1).toBeDefined()
      expect(file1?.isDirectory).toBe(false)
      expect(file1?.size).toBe(5)

      expect(sub).toBeDefined()
      expect(sub?.isDirectory).toBe(true)
      expect(sub?.children[0].name).toBe('file2.txt')
      expect(sub?.children[0].size).toBe(5)
   })
})