import express, { Request, Response } from 'express'
import dotenv from 'dotenv'
import Redis from 'ioredis'
import cors from 'cors'
import { Server } from 'socket.io'
import Docker from 'dockerode'
import { generateSlug } from 'random-word-slugs'
import http from 'http'
import { cleanupExpiredProjects } from './services/cleanup'

dotenv.config()

interface ProjectRequest {
   githubURL: string
   slug?: string
}

const PORT = process.env.PORT || 9000
const REDIS_URL = process.env.REDIS_URL!
const DOCKER_SOCKET = process.env.DOCKER_SOCKET || '/var/run/docker.sock'
const BUILD_IMAGE_NAME = process.env.BUILD_IMAGE_NAME!
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT!
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY!
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY!
const MINIO_BUCKET = process.env.MINIO_BUCKET!
const REVERSE_PROXY_DOMAIN = process.env.REVERSE_PROXY_DOMAIN || 'localhost'
// const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const USE_HTTPS = process.env.USE_HTTPS !== 'false'
const SERVER_IP = process.env.SERVER_IP!
const TTL_HOURS = parseInt(process.env.TTL_HOURS || '24')
const app = express()

const httpServer = http.createServer(app)

const redis = new Redis(REDIS_URL)
const subscriber = new Redis(REDIS_URL)

const io = new Server(httpServer, {
   cors: { origin: '*' },
   path: '/socket.io'
})

io.on('connection', (socket) => {
   socket.on('subscribe', (channel: string) => {
      socket.join(channel)
      socket.emit('message', `Joined ${channel}`)
   })
})

const docker = new Docker({
   socketPath: DOCKER_SOCKET
})

app.use(cors({
   origin: '*',
   credentials: true
}))

app.use(express.json())

app.post('/new-project', async (req: Request<{}, {}, ProjectRequest>, res: Response) => {
   const { githubURL, slug } = req.body
   const projectSlug = slug ? slug : generateSlug()

   try {
      console.log(`🚀 Criando container para projeto: ${projectSlug}`)

      const container = await docker.createContainer({
         Image: BUILD_IMAGE_NAME,
         name: `build-${projectSlug}-${Date.now()}`,
         Env: [
            `GITHUB_REPOSITORY_URL=${githubURL}`,
            `PROJECT_ID=${projectSlug}`,
            `REDIS_URL=${REDIS_URL}`,
            `MINIO_ENDPOINT=${MINIO_ENDPOINT}`,
            `MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}`,
            `MINIO_SECRET_KEY=${MINIO_SECRET_KEY}`,
            `MINIO_BUCKET=${MINIO_BUCKET}`
         ],
         HostConfig: {
            AutoRemove: true,
            NetworkMode: 'bruumhost_bruumhost-network'
         },
         AttachStdout: true, // !!!
         AttachStderr: true // !!!
      })

      await container.start()
      console.log(`🚀 Container iniciado: ${container.id}`)

      const protocol = USE_HTTPS ? 'https' : 'http'
      const previewURL = `${protocol}://${projectSlug}.${REVERSE_PROXY_DOMAIN}${USE_HTTPS ? '' : ':8000'}`

      await redis.set(
         `project:${projectSlug}`,
         JSON.stringify({
            slug: projectSlug,
            githubURL,
            createdAt: Date.now(),
            expiresAt: Date.now() + (TTL_HOURS * 60 * 60 * 1000)
         }),
         'EX',
         TTL_HOURS * 60 * 60 // TTL in seconds
      )

      return res.json({
         status: 'queued',
         data: {
            projectSlug,
            url: previewURL
         }
      })
   } catch (error: any) {
      console.error(`Erro ao executar Docker: ${error}`)

      return res.status(500).json({
         status: 'error',
         message: 'Falha ao iniciar build',
         error: error.message
      })
   }
})

async function initRedisSubscribe() {
   console.log('Subscribed to logs...')
   subscriber.psubscribe('logs:*')
   subscriber.on('pmessage', (pattern: string, channel: string, message: string) => {
      io.to(channel).emit('message', message)
   })
}

initRedisSubscribe()

setInterval(async () => {
   console.log('Running cleanup...')
   try {
      await cleanupExpiredProjects()
   } catch (error: any) {
      console.error(`Error running cleanup: ${error}`)
   }
}, 1000 * 60 * 20) // Run every 20 minutes

httpServer.listen(PORT, () => {
   console.log(`API Server Running on port ${PORT}`)
   console.log(`Socket Server Running at /socket.io`)
})