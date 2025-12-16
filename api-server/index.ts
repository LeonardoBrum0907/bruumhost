import express, { Request, Response }	 from 'express'
import dotenv from 'dotenv'
import Redis from 'ioredis'
import cors from 'cors'
import { Server } from 'socket.io'
import Docker from 'dockerode'
import { generateSlug } from 'random-word-slugs'

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
const DOMAIN = process.env.DOMAIN || 'localhost'

const app = express()

const subscriber = new Redis(REDIS_URL)

const io = new Server({ cors: { origin: '*' } })

io.on('connection', (socket) => {
   socket.on('subscribe', (channel: string) => {
      socket.join(channel)
      socket.emit('message', `Joined ${channel}`)
   })
})

io.listen(9002)

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
      const container = await docker.createContainer({
         Image: BUILD_IMAGE_NAME,
         name: `build-${projectSlug}-${Date.now()}`,
         Env: [
            `GIT_REPOSITORY__URL=${githubURL}`,
            `PROJECT_ID=${projectSlug}`,
            `REDIS_URL=${REDIS_URL}`,
            `MINIO_ENDPOINT=${MINIO_ENDPOINT}`,
            `MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}`,
            `MINIO_SECRET_KEY=${MINIO_SECRET_KEY}`,
            `MINIO_BUCKET=${MINIO_BUCKET}`
         ],
         HostConfig: {
            AutoRemove: true
         },
         AttachStdout: true, // !!!
         AttachStderr: true // !!!
      })

      await container.start()

      console.log(`Container iniciado: ${container.id}`)

      return res.json({
         status: 'queued',
         data: {
            projectSlug,
            url: `http://${projectSlug}.${DOMAIN}`
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

app.listen(PORT, () => console.log(`API Server Running on port ${PORT}`))