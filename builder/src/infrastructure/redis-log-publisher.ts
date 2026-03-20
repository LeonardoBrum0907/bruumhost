import Redis from "ioredis";
import { LogPublisher } from "../application/ports/log-publisher";
import { DeployStatus, LogMessage, LogType } from "../domain/messages";

export class RedisLogPublisher implements LogPublisher {
   constructor(
      private readonly redis: Redis,
      private readonly projectId: string
   ) {}

   publish(
      log: string,
      metadata?: { type?: LogType, status?: DeployStatus }
   ): void {
      const message: LogMessage = {
         log,
         type: metadata?.type,
         status: metadata?.status,
         timestamp: Date.now()
      }

      this.redis.publish(`logs:${this.projectId}`, JSON.stringify(message))
   }
}