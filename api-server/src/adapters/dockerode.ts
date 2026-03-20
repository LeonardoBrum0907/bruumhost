import type Docker from 'dockerode'
import { DockerClientPort } from "../core/ports";

export function makeDockerodeAdapter(docker: Docker): DockerClientPort {
   return {
      createContainer(options) {
         return docker.createContainer(options)
      }
   }
}