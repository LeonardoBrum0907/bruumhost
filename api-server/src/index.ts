import express, { Request, Response } from 'express'
import dotenv from 'dotenv'
import Redis from 'ioredis'
import cors from 'cors'
import { Server } from 'socket.io'
import Docker from 'dockerode'
import { generateSlug } from 'random-word-slugs'
import http from 'http'
import { cleanupExpiredProjects } from './services/cleanup'
import { createProject } from './services/create-project'
import { readEnv } from './core/env'
import { makeDockerodeAdapter } from './adapters/dockerode'
import { makeRedisAdapter } from './adapters/ioredis'
import { makeImageCheckerAdapter } from './adapters/image-checker'
import { systemClock } from './adapters/clock'

dotenv.config()

interface ProjectRequest {
   githubURL: string
   slug?: string
}

const PORT = process.env.PORT || 9000
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
   .split(',')
   .map(o => o.trim())
   .filter(Boolean)

const app = express()
const httpServer = http.createServer(app)

const env = readEnv(process.env)

const redis = new Redis(env.REDIS_URL)
const subscriber = new Redis(env.REDIS_URL)

const docker = new Docker({
   socketPath: env.DOCKER_SOCKET
})

async function ensureImageExists(imageName: string): Promise<void> {
   try {
      console.log(`🔍 Verificando se a imagem ${imageName} existe localmente...`)

      const images = await docker.listImages()
      const imageExists = images.some((img) =>
         img.RepoTags && img.RepoTags.some(tag => tag === imageName)
      )

      if (imageExists) {
         console.log(`✅ Imagem ${imageName} já existe localmente`)
         return
      }

      console.log(`📥 Imagem ${imageName} não encontrada. Fazendo pull do Docker Hub...`)

      const stream = await docker.pull(imageName)

      return new Promise((resolve, reject) => {
         docker.modem.followProgress(stream, (err: Error | null) => {
            if (err) {
               console.error(`❌ Erro ao fazer pull da imagem: ${err.message}`)
               reject(err)
            } else {
               console.log(`✅ Imagem ${imageName} baixada com sucesso!`)
               resolve()
            }
         })
      })
   } catch (error) {
      if (error instanceof Error) {
         console.error(`❌ Erro ao verificar/baixar imagem: ${error.message}`)
         throw error
      }

      console.error("Ocorreu um erro inesperado", error)
   }
}

const dockerPort = makeDockerodeAdapter(docker)
const redisPort = makeRedisAdapter(redis)
const imageCheckerPort = makeImageCheckerAdapter(ensureImageExists)
const clockPort = systemClock

const io = new Server(httpServer, {
   cors: {
      origin: (origin, callback) => {
         if (!origin) return callback(null, true)
         if (allowedOrigins.includes(origin)) return callback(null, true)
         return callback(new Error(`Not allowed by CORS: ${origin}`))
      }
   },
   path: '/socket.io'
})

io.on('connection', (socket) => {
   socket.on('subscribe', (channel: string) => {
      socket.join(channel)
   })
})

app.use(cors({
   origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      return callback(new Error(`Not allowed by CORS: ${origin}`))
   },
   credentials: true
}))

app.use(express.json())

app.post('/new-project', async (req: Request<{}, {}, ProjectRequest>, res: Response) => {
   const { githubURL, slug } = req.body

   try {
      const result = await createProject(
         { githubURL, slug },
         {
            docker: dockerPort,
            redis: redisPort,
            imageChecker: imageCheckerPort,
            clock: clockPort,
            generateSlug,
            env
         }
      )

      return res.json({
         status: 'queued',
         data: result
      })
   } catch (error) {
      if (error instanceof Error) {
         console.error(`❌ Erro ao executar Docker: ${error}`)
         console.error(`Stack trace: ${error.stack}`)
   
         return res.status(500).json({
            status: 'error',
            message: 'Falha ao iniciar build',
            error: error.message,
            details: error.stack
         })
      }
      console.error(`❌ Erro ao executar Docker: ${error}`)

      return res.status(500).json({
         status: 'error',
         message: 'Falha ao iniciar build',
         error: error
      })
   }
})

// test commit

async function initRedisSubscribe() {
   console.log('Subscribed to logs...')
   subscriber.psubscribe('logs:*')
   subscriber.on('pmessage', (pattern: string, channel: string, message: string) => {
      io.to(channel).emit('message', message)
   })
}

initRedisSubscribe()

async function initializeBuilderImage() {
   try {
      await ensureImageExists(env.BUILD_IMAGE_NAME)
   } catch (error) {
      if (error instanceof Error) {
         console.warn(`⚠️ Não foi possível verificar/baixar a imagem na inicialização: ${error.message}`)
         console.warn(`⚠️ A imagem será baixada na primeira requisição`)
      }
      console.warn(`⚠️ Não foi possível verificar/baixar a imagem na inicialização: ${error}`)      
   }
}

initializeBuilderImage().catch(() => { })

setInterval(async () => {
   console.log('Running cleanup...')
   try {
      await cleanupExpiredProjects()
   } catch (error) {
      console.error(`Error running cleanup: ${error}`)
   }
}, 1000 * 60 * 10) // Run every 10 minutes

httpServer.listen(PORT, () => {
   console.log(`API Server Running on port ${PORT}`)
   console.log(`Socket Server Running at /socket.io`)
   console.log(`📦 Builder Image: ${env.BUILD_IMAGE_NAME}`)
})