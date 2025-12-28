import * as Minio from 'minio'
import dotenv from 'dotenv'
import express, { Request, Response } from 'express'
import { Readable } from 'stream'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 8000

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT!
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY!
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY!
const MINIO_BUCKET = process.env.MINIO_BUCKET!
// Tempo de expiração da URL pré-assinada em segundos (padrão: 1 hora)
const PRESIGNED_URL_EXPIRES_IN = parseInt(process.env.PRESIGNED_URL_EXPIRES_IN || '3600')

// Extrair host e porta do endpoint (ex: https://minio.example.com ou https://minio.example.com:9000)
const endpointUrl = new URL(MINIO_ENDPOINT)
const endPoint = endpointUrl.hostname
const port = endpointUrl.port ? parseInt(endpointUrl.port) : (endpointUrl.protocol === 'https:' ? 443 : 80)
const useSSL = endpointUrl.protocol === 'https:'

// Criar cliente MinIO
const minioClient = new Minio.Client({
   endPoint,
   port,
   useSSL,
   accessKey: MINIO_ACCESS_KEY,
   secretKey: MINIO_SECRET_KEY
})

// Função para substituir URLs absolutas em CSS
function replaceAbsoluteUrlsInCSS(cssContent: string, projectSlug: string): string {
   const projectSlugPrefix = `/${projectSlug}/`
   
   // Substituir URLs absolutas em url() no CSS
   let replacedCount = 0
   const result = cssContent.replace(/url\((["']?)\/([^"')]*)\1\)/g, (match, quote, url) => {
      // Se a URL já começa com projectSlug, não substituir
      if (url.startsWith(`${projectSlug}/`)) {
         return match
      }
      // Se for um protocolo (http, https, mailto, tel, data), não substituir
      if (/^(https?|mailto|tel|data):/.test(url)) {
         return match
      }
      // Caso contrário, adicionar o projectSlug
      replacedCount++
      return `url(${quote}${projectSlugPrefix}${url}${quote})`
   })
   
   if (replacedCount > 0) {
      console.log(`✅ CSS processed: replaced ${replacedCount} absolute URLs with ${projectSlugPrefix}`)
   }
   
   return result
}

// Função para substituir URLs absolutas por relativas ao projectSlug
function replaceAbsoluteUrls(htmlContent: string, projectSlug: string): string {
   const projectSlugPrefix = `/${projectSlug}/`
   let replacedCount = 0
   
   // Substituir URLs absolutas em diferentes formatos:
   // 1. href="/..." e src="/..." (atributos HTML)
   // 2. srcset="/..." (atributo srcset)
   // 3. url("/...") e url('/...') (CSS inline)
   
   // 1. Substituir em atributos href e src
   // Captura: href="/path" ou href='/path' ou href="/path" ou href="/path query"
   htmlContent = htmlContent.replace(/(href|src)\s*=\s*(["'])\/([^"']*)\2/gi, (match, attr, quote, url) => {
      // Se a URL está vazia, não substituir
      if (!url || url.trim() === '') {
         return match
      }
      // Se a URL já começa com projectSlug, não substituir
      if (url.startsWith(`${projectSlug}/`)) {
         return match
      }
      // Se for um protocolo (http, https, mailto, tel, data), não substituir
      if (/^(https?|mailto|tel|data):/.test(url)) {
         return match
      }
      // Caso contrário, adicionar o projectSlug
      replacedCount++
      const newUrl = `${projectSlugPrefix}${url}`
      return `${attr}=${quote}${newUrl}${quote}`
   })
   
   // 2. Substituir em atributo srcset (pode ter múltiplas URLs)
   htmlContent = htmlContent.replace(/srcset=(["'])([^"']*)/g, (match, quote, srcsetValue) => {
      const urls = srcsetValue.split(',').map((urlPart: string) => {
         const trimmed = urlPart.trim()
         // srcset pode ter formato "url width" ou "url 2x"
         const parts = trimmed.split(/\s+/)
         const url = parts[0]
         
         if (url.startsWith('/') && !url.startsWith(`/${projectSlug}/`)) {
            // Se for protocolo, não substituir
            if (/^(https?|mailto|tel|data):/.test(url)) {
               return trimmed
            }
            // Adicionar projectSlug
            const newUrl = `${projectSlugPrefix}${url.substring(1)}`
            return parts.length > 1 ? `${newUrl} ${parts.slice(1).join(' ')}` : newUrl
         }
         return trimmed
      })
      return `srcset=${quote}${urls.join(', ')}`
   })
   
   // 3. Substituir em CSS url() (dentro de style tags ou atributos)
   htmlContent = htmlContent.replace(/url\s*\(\s*(["']?)\/([^"')]*)\1\s*\)/gi, (match, quote, url) => {
      if (url.startsWith(`${projectSlug}/`)) {
         return match
      }
      if (/^(https?|mailto|tel|data):/.test(url)) {
         return match
      }
      replacedCount++
      return `url(${quote}${projectSlugPrefix}${url}${quote})`
   })
   
   if (replacedCount > 0) {
      console.log(`✅ HTML processed: replaced ${replacedCount} absolute URLs with ${projectSlugPrefix}`)
   }
   
   return htmlContent
}

// Mapeamento de extensões para Content-Type
function getContentType(filePath: string): string {
   const ext = filePath.split('.').pop()?.toLowerCase()
   const contentTypes: Record<string, string> = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'eot': 'application/vnd.ms-fontobject',
      'map': 'application/json',
      'webp': 'image/webp'
   }
   return contentTypes[ext || ''] || 'application/octet-stream'
}

async function getFileFromMinIO(bucketName: string, objectName: string): Promise<{ stream: Readable; contentType: string } | null> {
   try {
      const stream = await minioClient.getObject(bucketName, objectName)
      
      // Tentar obter metadata para Content-Type
      let contentType: string
      try {
         const stat = await minioClient.statObject(bucketName, objectName)
         contentType = stat.metaData?.['content-type'] || 
                      stat.metaData?.['Content-Type'] || 
                      getContentType(objectName)
      } catch {
         contentType = getContentType(objectName)
      }

      return {
         stream: stream as Readable,
         contentType
      }
   } catch (error: any) {
      if (error.code === 'NotFound' || error.message?.includes('does not exist')) {
         return null
      }
      throw error
   }
}

async function getPresignedUrl(bucketName: string, objectName: string, contentType?: string): Promise<string> {
   const headers: Record<string, string> = {}
   
   if (contentType) {
      headers['response-content-type'] = contentType
   }
   
   // Gerar URL pré-assinada com headers de resposta
   const url = await minioClient.presignedGetObject(
      bucketName, 
      objectName, 
      PRESIGNED_URL_EXPIRES_IN,
      headers
   )
   return url
}

app.use(async (req: Request, res: Response) => {
   // Suportar tanto subdomain-based quanto path-based routing
   // Subdomain: projeto1.leobrum.run -> projectSlug = projeto1
   // Path: leobrum.run/projeto1/ -> projectSlug = projeto1
   
   const hostname = req.hostname
   let projectSlug: string | null = null
   let filePath = req.path
   
   // Tentar extrair projectSlug do subdomínio primeiro
   // Ex: projeto1.leobrum.run -> projeto1
   // Ex: leobrum.run -> null (sem subdomínio)
   const hostnameParts = hostname.split('.')
   if (hostnameParts.length > 2) {
      // Tem subdomínio (projeto1.leobrum.run -> ['projeto1', 'leobrum', 'run'])
      projectSlug = hostnameParts[0]
      console.log(`🌐 Subdomain-based routing detected: ${hostname} -> projectSlug: ${projectSlug}`)
   }
   
   // Se não encontrou no subdomínio, tentar extrair do path
   if (!projectSlug) {
      let path = req.path
      
      // Remover query string se houver
      path = path.split('?')[0]
      
      // Garantir que comece com /
      if (!path.startsWith('/')) {
         path = '/' + path
      }
      
      // Normalizar: remover trailing slash exceto se for apenas /
      if (path.length > 1 && path.endsWith('/')) {
         path = path.slice(0, -1)
      }
      
      const pathParts = path.split('/').filter(Boolean)
      projectSlug = pathParts[0] || null
      
      if (projectSlug) {
         // Remover o projectSlug do path para construir o caminho do arquivo
         filePath = pathParts.length > 1 
            ? '/' + pathParts.slice(1).join('/')
            : '/index.html'
         
         console.log(`📂 Path-based routing detected: ${req.path} -> projectSlug: ${projectSlug}, filePath: ${filePath}`)
      }
   } else {
      // Subdomain-based: filePath é o path completo
      filePath = req.path === '/' ? '/index.html' : req.path.split('?')[0]
   }
   
   // Lista de paths conhecidos que não são projectSlugs (são assets/recursos comuns)
   const knownAssetPaths = ['assets', 'static', '_next', 'dist', 'build', 'public', 'images', 'img', 'css', 'js', 'fonts', 'favicon.ico']
   
   // Se não houver projectSlug, retornar 404
   if (!projectSlug) {
      console.log(`❌ No projectSlug found in hostname (${hostname}) or path (${req.path})`)
      res.status(404).send('Project not found')
      return
   }
   
   // Se estamos usando path-based routing e o primeiro segmento do path é um caminho de asset conhecido,
   // provavelmente é uma requisição incorreta (os assets devem ter o projectSlug no path)
   if (hostnameParts.length <= 2) {
      const pathParts = req.path.split('/').filter(Boolean)
      if (pathParts.length > 0 && knownAssetPaths.includes(pathParts[0].toLowerCase())) {
         console.log(`⚠️ Request to asset path without projectSlug: ${req.path} - This suggests CSS/HTML processing failed`)
         res.status(404).send('Asset not found. Please ensure the project slug is in the URL path or subdomain.')
         return
      }
   }

   // Garantir que filePath está normalizado
   const cleanFilePath = filePath === '/' ? '/index.html' : filePath.split('?')[0]
   const objectName = `__outputs/${projectSlug}${cleanFilePath}`.replace(/\/+/g, '/')

   console.log(`📁 Request: ${req.path} -> projectSlug: ${projectSlug}, filePath: ${cleanFilePath}, objectName: ${objectName}`)

   try {
      // Tentar buscar o arquivo
      const file = await getFileFromMinIO(MINIO_BUCKET, objectName)

      if (file) {
         console.log(`✅ File found: ${objectName}, contentType: ${file.contentType}`)
         // Configurar headers apropriados
         res.setHeader('Content-Type', file.contentType)
         res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
         
         // Para arquivos HTML, adicionar base tag para corrigir URLs relativas
         if (file.contentType === 'text/html') {
            let htmlContent = ''
            file.stream.on('data', (chunk) => {
               htmlContent += chunk.toString()
            })
            
            file.stream.on('end', () => {
               // Adicionar base tag se não existir, ou substituir se existir
               const baseTag = `<base href="/${projectSlug}/">`
               
               // Verificar se já existe uma tag base (case-insensitive, com espaços)
               const baseTagRegex = /<base\s+[^>]*href\s*=\s*["'][^"']*["'][^>]*>/i
               if (baseTagRegex.test(htmlContent)) {
                  // Substituir base tag existente
                  htmlContent = htmlContent.replace(baseTagRegex, baseTag)
                  console.log(`✅ Replaced existing base tag with: ${baseTag}`)
               } else {
                  // Buscar por <head> ou <head com atributos (case-insensitive)
                  const headTagRegex = /<head[^>]*>/i
                  if (headTagRegex.test(htmlContent)) {
                     // Substituir <head> por <head><base href="...">
                     htmlContent = htmlContent.replace(headTagRegex, (match) => `${match}\n    ${baseTag}`)
                     console.log(`✅ Added base tag after head: ${baseTag}`)
                  } else {
                     // Se não tem <head>, tentar adicionar antes de </head> ou no início
                     if (htmlContent.includes('</head>')) {
                        htmlContent = htmlContent.replace('</head>', `    ${baseTag}\n</head>`)
                        console.log(`✅ Added base tag before closing head: ${baseTag}`)
                     } else {
                        // Último recurso: adicionar no início do HTML
                        htmlContent = baseTag + '\n' + htmlContent
                        console.log(`⚠️ Added base tag at the beginning (no head found): ${baseTag}`)
                     }
                  }
               }
               
               // Substituir URLs absolutas por relativas ao projectSlug
               htmlContent = replaceAbsoluteUrls(htmlContent, projectSlug)
               
               console.log(`📄 HTML processed successfully, base tag: ${baseTag}`)
               res.send(htmlContent)
            })
            
            file.stream.on('error', (error) => {
               console.error('Stream error:', error)
               res.status(500).send('Error reading file')
            })
         } else if (file.contentType === 'text/css' || file.contentType?.includes('css') || cleanFilePath.endsWith('.css')) {
            // Para arquivos CSS, processar URLs absolutas
            console.log(`🎨 Processing CSS file: ${objectName} (contentType: ${file.contentType})`)
            let cssContent = ''
            file.stream.on('data', (chunk) => {
               cssContent += chunk.toString()
            })
            
            file.stream.on('end', () => {
               cssContent = replaceAbsoluteUrlsInCSS(cssContent, projectSlug)
               res.send(cssContent)
            })
            
            file.stream.on('error', (error) => {
               console.error('Stream error:', error)
               res.status(500).send('Error reading file')
            })
         } else {
            // Para outros arquivos, fazer pipe direto
            file.stream.pipe(res)
         }
         return
      }

      console.log(`⚠️ File not found: ${objectName}`)

      // Se não encontrou e não é index.html, tentar index.html (SPA routing)
      if (cleanFilePath !== '/index.html') {
         const indexObjectName = `__outputs/${projectSlug}/index.html`
         console.log(`🔄 Trying index.html: ${indexObjectName}`)
         const indexFile = await getFileFromMinIO(MINIO_BUCKET, indexObjectName)

         if (indexFile) {
            console.log(`✅ Index file found: ${indexObjectName}`)
            res.setHeader('Content-Type', indexFile.contentType)
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
            
            let htmlContent = ''
            indexFile.stream.on('data', (chunk) => {
               htmlContent += chunk.toString()
            })
            
            indexFile.stream.on('end', () => {
               // Adicionar base tag para SPA routing
               const baseTag = `<base href="/${projectSlug}/">`
               
               // Verificar se já existe uma tag base (case-insensitive, com espaços)
               const baseTagRegex = /<base\s+[^>]*href\s*=\s*["'][^"']*["'][^>]*>/i
               if (baseTagRegex.test(htmlContent)) {
                  // Substituir base tag existente
                  htmlContent = htmlContent.replace(baseTagRegex, baseTag)
                  console.log(`✅ Replaced existing base tag with: ${baseTag}`)
               } else {
                  // Buscar por <head> ou <head com atributos (case-insensitive)
                  const headTagRegex = /<head[^>]*>/i
                  if (headTagRegex.test(htmlContent)) {
                     // Substituir <head> por <head><base href="...">
                     htmlContent = htmlContent.replace(headTagRegex, (match) => `${match}\n    ${baseTag}`)
                     console.log(`✅ Added base tag after head: ${baseTag}`)
                  } else {
                     // Se não tem <head>, tentar adicionar antes de </head> ou no início
                     if (htmlContent.includes('</head>')) {
                        htmlContent = htmlContent.replace('</head>', `    ${baseTag}\n</head>`)
                        console.log(`✅ Added base tag before closing head: ${baseTag}`)
                     } else {
                        // Último recurso: adicionar no início do HTML
                        htmlContent = baseTag + '\n' + htmlContent
                        console.log(`⚠️ Added base tag at the beginning (no head found): ${baseTag}`)
                     }
                  }
               }
               
               // Substituir URLs absolutas por relativas ao projectSlug
               htmlContent = replaceAbsoluteUrls(htmlContent, projectSlug)
               
               console.log(`📄 HTML processed for SPA routing, base tag: ${baseTag}`)
               res.send(htmlContent)
            })
            
            indexFile.stream.on('error', (error) => {
               console.error('Stream error:', error)
               res.status(500).send('Error reading file')
            })
            return
         }
      }

      // 404
      console.log(`❌ 404: ${objectName}`)
      res.status(404).send('Project not found')
   } catch (error: any) {
      console.error('Error serving file:', error)
      res.status(500).send('Internal server error')
   }
})

app.listen(PORT, () => console.log(`Reverse Proxy Running..${PORT}`))