type UnixMs = number

export interface ClockPort {
   now(): UnixMs
}

export interface ImageCheckerPort {
   ensureImageExists(imageName: string): Promise<void>
}

export interface DockerCreateContainerOptions {
   Image: string
   name: string
   Env: string[]
   HostConfig: {
     AutoRemove: boolean
     NetworkMode: string
   }
   AttachStdout: boolean
   AttachStderr: boolean
}

interface DockerContainerPort {
   start(): Promise<void>
}

export interface DockerClientPort {
   createContainer(options: DockerCreateContainerOptions): Promise<DockerContainerPort>
}

export interface RedisPort {
   set(
      key: string,
      value: string,
      mode: 'EX',
      ttlSeconds: number
   ): Promise<string>
}