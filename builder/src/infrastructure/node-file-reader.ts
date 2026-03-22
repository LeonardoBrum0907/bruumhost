import { promises as fs } from 'fs'

export async function readFileFromDisk(localPath: string): Promise<Buffer> {
   return fs.readFile(localPath)
}