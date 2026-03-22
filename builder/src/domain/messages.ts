export type LogType = 'status' | 'error' | 'warning' | 'info' | 'debug'
export type DeployStatus = 'idle' | 'building' | 'uploading' | 'success' | 'error'

export interface LogMessage {
   log: string
   type?: LogType
   status?: DeployStatus
   timestamp?: number
}