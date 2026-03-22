import { ObjectStorage } from "@/application/ports/object-storage";
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export class S3ObjectStorage implements ObjectStorage {
   constructor(
      private readonly s3Client: S3Client,
      private readonly bucketName: string
   ) {}

   async ensureBucket(name: string): Promise<void> {
      try {
         await this.s3Client.send(new HeadBucketCommand({ Bucket: name }))
      } catch (error: any) {
         if (error.name === 'NotFound' || error.$metadata.httpStatusCode === 404) {
            await this.s3Client.send( new CreateBucketCommand({ Bucket: name }))
            return 
         }
          throw error
      }
   }

   async uploadFile(key: string, body: Buffer, contentType: string): Promise<void> {
      await this.s3Client.send(
         new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: body,
            ContentType: contentType
         })
      )
   }
}