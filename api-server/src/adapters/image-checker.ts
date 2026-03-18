import { ImageCheckerPort } from "../core/ports";

export function makeImageCheckerAdapter(ensureImageExists: (imageName: string) => Promise<void>): ImageCheckerPort {
   return { ensureImageExists }
}