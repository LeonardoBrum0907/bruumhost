import { DeployStatus, LogType } from "../../domain/messages";

export interface LogPublisher {
   publish(log: string, metadata?: { type?: LogType, status?: DeployStatus }): void
}