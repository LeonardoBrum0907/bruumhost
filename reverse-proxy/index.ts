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
   
   // #region agent log - H1: Verificar se função é executada
   fetch('http://127.0.0.1:7242/ingest/a13c286b-8784-40d8-8cac-c9f9462810bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reverse-proxy/index.ts:62',message:'replaceAbsoluteUrls ENTRY',data:{projectSlug,htmlLength:htmlContent.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
   // #endregion
   
   console.log(`🔄 Processing HTML URLs for projectSlug: ${projectSlug}`)
   let replacementCount = 0
   
   // Log de amostra do HTML para debug (primeiros 500 chars)
   const sample = htmlContent.substring(0, 500).replace(/\n/g, ' ')
   console.log(`📝 HTML sample: ${sample}...`)
   
   // Substituir URLs absolutas em diferentes formatos:
   // 1. href="/..." e src="/..." (atributos HTML) - com aspas
   // 2. href=/... e src=/... (atributos HTML) - sem aspas
   // 3. srcset="/..." (atributo srcset)
   // 4. url("/...") e url('/...') (CSS inline)
   
   // 1. Substituir em atributos href e src COM ASPAS (simples ou duplas)
   // #region agent log - H2: Contar matches da primeira regex
   let regex1Matches = 0
   const regex1Samples: string[] = []
   // #endregion
   htmlContent = htmlContent.replace(/(href|src)\s*=\s*(["'])\/([^"']*)(["'])/gi, (match, attr, openQuote, url, closeQuote) => {
      // #region agent log - H2: Registrar match
      regex1Matches++
      if (regex1Samples.length < 5) regex1Samples.push(`${attr}="/${url}"`)
      // #endregion
      // Se a URL já começa com projectSlug, não substituir
      if (url.startsWith(`${projectSlug}/`)) {
         return match
      }
      // Se for um protocolo (http, https, mailto, tel, data), não substituir
      if (/^(https?|mailto|tel|data):/.test(url)) {
         return match
      }
      // Caso contrário, adicionar o projectSlug
      replacementCount++
      console.log(`  🔄 Replacing: ${attr}="${url}" -> ${attr}="${projectSlugPrefix}${url}"`)
      return `${attr}=${openQuote}${projectSlugPrefix}${url}${closeQuote}`
   })
   // #region agent log - H2: Log resultados da primeira regex
   fetch('http://127.0.0.1:7242/ingest/a13c286b-8784-40d8-8cac-c9f9462810bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reverse-proxy/index.ts:90',message:'Regex 1 (href/src with quotes) results',data:{matches:regex1Matches,samples:regex1Samples,replacementCount},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
   // #endregion
   
   // 2. Substituir em atributos href e src SEM ASPAS (HTML antigo)
   htmlContent = htmlContent.replace(/(href|src)\s*=\s*\/([^\s>]*)/gi, (match, attr, url) => {
      // Se a URL já começa com projectSlug, não substituir
      if (url.startsWith(`${projectSlug}/`)) {
         return match
      }
      // Se for um protocolo, não substituir
      if (/^(https?|mailto|tel|data):/.test(url)) {
         return match
      }
      replacementCount++
      console.log(`  🔄 Replacing (no quotes): ${attr}=/${url} -> ${attr}="${projectSlugPrefix}${url}"`)
      return `${attr}="${projectSlugPrefix}${url}"`
   })
   
   // 3. Substituir em atributo srcset (pode ter múltiplas URLs)
   htmlContent = htmlContent.replace(/srcset\s*=\s*(["'])([^"']*)(["'])/gi, (match, openQuote, srcsetValue, closeQuote) => {
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
            replacementCount++
            console.log(`  🔄 Replacing srcset: ${url} -> ${projectSlugPrefix}${url.substring(1)}`)
            const newUrl = `${projectSlugPrefix}${url.substring(1)}`
            return parts.length > 1 ? `${newUrl} ${parts.slice(1).join(' ')}` : newUrl
         }
         return trimmed
      })
      return `srcset=${openQuote}${urls.join(', ')}${closeQuote}`
   })
   
   // 4. Substituir em CSS url() (dentro de style tags ou atributos inline)
   htmlContent = htmlContent.replace(/url\(\s*(["']?)\/([^"')]*)\1\s*\)/gi, (match, quote, url) => {
      if (url.startsWith(`${projectSlug}/`)) {
         return match
      }
      if (/^(https?|mailto|tel|data):/.test(url)) {
         return match
      }
      replacementCount++
      console.log(`  🔄 Replacing url(): /${url} -> ${projectSlugPrefix}${url}`)
      return `url(${quote}${projectSlugPrefix}${url}${quote})`
   })
   
   // 5. Substituir data-src e data-href (lazy loading)
   htmlContent = htmlContent.replace(/(data-src|data-href)\s*=\s*(["'])\/([^"']*)(["'])/gi, (match, attr, openQuote, url, closeQuote) => {
      if (url.startsWith(`${projectSlug}/`)) {
         return match
      }
      if (/^(https?|mailto|tel|data):/.test(url)) {
         return match
      }
      replacementCount++
      console.log(`  🔄 Replacing ${attr}: /${url} -> ${projectSlugPrefix}${url}`)
      return `${attr}=${openQuote}${projectSlugPrefix}${url}${closeQuote}`
   })
   
   // 6. FORÇAR base tag a ser usada - substituir URLs relativas que comecem com assets/
   // Isso captura casos onde o HTML tem: src="assets/..." em vez de src="/assets/..."
   // #region agent log - H5: Contar matches de URLs relativas
   let regex6Matches = 0
   const regex6Samples: string[] = []
   // #endregion
   htmlContent = htmlContent.replace(/(href|src|data-src)\s*=\s*(["'])(assets\/[^"']*)(["'])/gi, (match, attr, openQuote, url, closeQuote) => {
      // #region agent log - H5: Registrar match
      regex6Matches++
      if (regex6Samples.length < 5) regex6Samples.push(`${attr}="${url}"`)
      // #endregion
      // Verificar se não é uma URL completa
      if (url.startsWith('http') || url.startsWith('//')) {
         return match
      }
      replacementCount++
      console.log(`  🔄 Replacing relative: ${attr}="${url}" -> ${attr}="${projectSlugPrefix}${url}"`)
      return `${attr}=${openQuote}${projectSlugPrefix}${url}${closeQuote}`
   })
   // #region agent log - H5: Log resultados de URLs relativas
   fetch('http://127.0.0.1:7242/ingest/a13c286b-8784-40d8-8cac-c9f9462810bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reverse-proxy/index.ts:155',message:'Regex 6 (relative assets/) results',data:{matches:regex6Matches,samples:regex6Samples,replacementCount},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H5'})}).catch(()=>{});
   // #endregion
   
   // 7. Também capturar outras pastas comuns (dist, build, public, static, images, img, css, js, fonts)
   const commonFolders = ['dist', 'build', 'public', 'static', 'images', 'img', 'css', 'js', 'fonts', 'media']
   for (const folder of commonFolders) {
      const pattern = new RegExp(`(href|src|data-src)\\s*=\\s*(["'])(${folder}\\/[^"']*)\\2`, 'gi')
      htmlContent = htmlContent.replace(pattern, (match, attr, openQuote, url) => {
         // Verificar se não é uma URL completa
         if (url.startsWith('http') || url.startsWith('//') || url.startsWith(`${projectSlug}/`)) {
            return match
         }
         replacementCount++
         console.log(`  🔄 Replacing relative (${folder}): ${attr}="${url}" -> ${attr}="${projectSlugPrefix}${url}"`)
         return `${attr}=${openQuote}${projectSlugPrefix}${url}${openQuote}`
      })
   }
   
   console.log(`📊 HTML processing complete: ${replacementCount} URLs replaced with /${projectSlug}/ prefix`)
   
   // #region agent log - H2: Analisar todas as URLs encontradas no HTML
   const allSrcMatches = htmlContent.match(/(href|src|data-src)\s*=\s*["'][^"']*["']/gi) || []
   const srcSamples = allSrcMatches.slice(0, 20).map(m => m.replace(/\s+/g, ' '))
   const assetUrls = allSrcMatches.filter(m => m.includes('asset')).slice(0, 10)
   const imageUrls = allSrcMatches.filter(m => m.includes('image')).slice(0, 10)
   fetch('http://127.0.0.1:7242/ingest/a13c286b-8784-40d8-8cac-c9f9462810bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reverse-proxy/index.ts:185',message:'replaceAbsoluteUrls EXIT - All URLs analysis',data:{projectSlug,totalReplacements:replacementCount,totalUrlsFound:allSrcMatches.length,srcSamples,assetUrls,imageUrls},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
   // #endregion
   
   if (replacementCount === 0) {
      console.log(`⚠️ WARNING: No absolute URLs were replaced! This is unusual and suggests:`)
      console.log(`   1. URLs might be relative (no leading /)`)
      console.log(`   2. URLs might be in JavaScript variables`)
      console.log(`   3. The HTML format is different than expected`)
      console.log(`   Sample of HTML being processed: ${htmlContent.substring(0, 300)}...`)
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
   // Extrair projectSlug do path ao invés do subdomínio
   // Ex: /projeto1/ -> projectSlug = projeto1
   // Ex: /projeto1/index.html -> projectSlug = projeto1, filePath = /index.html
   // Ex: /projeto1 -> projectSlug = projeto1, filePath = /index.html
   
   let path = req.path
   
   // Remover query string se houver
   path = path.split('?')[0]
   
   // Garantir que comece com /
   if (!path.startsWith('/')) {
      path = '/' + path
   }
   
   // Normalizar: remover trailing slash exceto se for apenas /
   // /projeto1/ -> /projeto1
   // /projeto1 -> /projeto1
   if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1)
   }
   
   const pathParts = path.split('/').filter(Boolean)
   const projectSlug = pathParts[0]
   
   // Lista de paths conhecidos que não são projectSlugs (são assets/recursos comuns)
   const knownAssetPaths = ['assets', 'static', '_next', 'dist', 'build', 'public', 'images', 'img', 'css', 'js', 'fonts']
   
   // Se não houver projectSlug, retornar 404
   if (!projectSlug) {
      console.log('❌ No projectSlug found in path:', req.path)
      res.status(404).send('Project not found')
      return
   }
   
   // Se o primeiro segmento do path é um caminho de asset conhecido, provavelmente é uma requisição incorreta
   // Isso indica que o CSS/HTML não foi processado corretamente
   if (knownAssetPaths.includes(projectSlug.toLowerCase())) {
      console.log(`⚠️ Request to asset path without projectSlug: ${req.path} - This suggests CSS/HTML processing failed`)
      res.status(404).send('Asset not found. Please ensure the project slug is in the URL path.')
      return
   }

   // Remover o projectSlug do path para construir o caminho do arquivo
   // Se não houver mais nada, usar /index.html
   const filePath = pathParts.length > 1 
      ? '/' + pathParts.slice(1).join('/')
      : '/index.html'
   
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
               
               // #region agent log - H4: Ver HTML antes da substituição
               const htmlSampleBefore = htmlContent.substring(0, 1000).replace(/\s+/g, ' ')
               fetch('http://127.0.0.1:7242/ingest/a13c286b-8784-40d8-8cac-c9f9462810bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reverse-proxy/index.ts:369',message:'HTML before replaceAbsoluteUrls',data:{projectSlug,htmlLength:htmlContent.length,htmlSample:htmlSampleBefore,contentType:file.contentType},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
               // #endregion
               
               // Substituir URLs absolutas por relativas ao projectSlug
               htmlContent = replaceAbsoluteUrls(htmlContent, projectSlug)
               
               // #region agent log - H4: Ver HTML depois da substituição
               const htmlSampleAfter = htmlContent.substring(0, 1000).replace(/\s+/g, ' ')
               fetch('http://127.0.0.1:7242/ingest/a13c286b-8784-40d8-8cac-c9f9462810bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reverse-proxy/index.ts:372',message:'HTML after replaceAbsoluteUrls',data:{projectSlug,htmlLength:htmlContent.length,htmlSample:htmlSampleAfter},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
               // #endregion
               
               console.log(`📄 HTML processed, base tag should be: ${baseTag}`)
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
               // #region agent log - H3: Ver CSS antes do processamento
               const cssSample = cssContent.substring(0, 500).replace(/\s+/g, ' ')
               fetch('http://127.0.0.1:7242/ingest/a13c286b-8784-40d8-8cac-c9f9462810bd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reverse-proxy/index.ts:395',message:'CSS before processing',data:{projectSlug,cssLength:cssContent.length,cssSample,filePath:cleanFilePath},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
               // #endregion
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
               
               console.log(`📄 HTML processed for SPA routing, base tag should be: ${baseTag}`)
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