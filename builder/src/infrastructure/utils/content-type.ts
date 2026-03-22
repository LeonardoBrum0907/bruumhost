import mime from "mime-types"

export function detectContentType(localPath: string): string {
   return (mime.lookup(localPath) || 'application/octet-stream') as string
}