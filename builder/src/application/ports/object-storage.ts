export interface ObjectStorage {
   ensureBucket(name: string): Promise<void>
   uploadFile(key: string, body: Buffer, contentType: string): Promise<void>
}