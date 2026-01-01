import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Input } from './components/ui/input'
import { Button } from './components/ui/button'
import { io } from 'socket.io-client'
import LightPillar from './components/LightPillar'
import { isValidURL } from './utils/validations'

const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:9000')

type DeplyStatus = 'idle' | 'building' | 'uploading' | 'success' | 'error'

const useDeployVisuals = (status: DeplyStatus | null) => {
   return useMemo(() => {
      const configs = {
         idle: {
            topColor: '#5227FF',
            bottomColor: '#FF9FFC',
            mixBlendMode: 'normal' as const,
            intensity: 1.0,
            glowAmount: 0.002,
            rotationSpeed: 0.5
         },
         building: {
            topColor: '#5227FF',
            bottomColor: '#60A5FA',
            mixBlendMode: 'screen' as const,
            intensity: 1.2,
            glowAmount: 0.007,
            rotationSpeed: 1.2
         },
         uploading: {
            topColor: '#5227FF',
            bottomColor: '#FCD34D',
            mixBlendMode: 'lighten' as const,
            intensity: 1.1,
            glowAmount: 0.0025,
            rotationSpeed: 0.6
         },
         success: {
            topColor: '#5227FF',
            bottomColor: '#34D399',
            mixBlendMode: 'screen' as const,
            intensity: 1.0,
            glowAmount: 0.002,
            rotationSpeed: 0.3
         },
         error: {
            topColor: '#5227FF',
            bottomColor: '#F87171',
            mixBlendMode: 'multiply' as const,
            intensity: 1.0,
            glowAmount: 0.003,
            rotationSpeed: 0.2
         }
      }

      return configs[status || 'idle']
   }, [status])
}

function App() {
   const [githubURL, setGithubURL] = useState('')
   const [logs, setLogs] = useState<string[]>([])
   const [deployStatus, setDeployStatus] = useState<DeplyStatus | null>(null)
   const [previewURL, setPreviewURL] = useState('')
   const [loading, setLoading] = useState(false)
   const apiURL = import.meta.env.VITE_API_URL || 'http://localhost:9000'

   const logsContainerRef = useRef<HTMLDivElement>(null)

   // Estados para controlar a transição fade out/in
   const [pillarOpacity, setPillarOpacity] = useState(1)
   const targetPillarProps = useDeployVisuals(deployStatus)
   const idlePillarProps = useDeployVisuals(null)
   const [currentPillarProps, setCurrentPillarProps] = useState(() => idlePillarProps)
   const previousStatusRef = useRef<DeplyStatus | null>(null)

   // Detecta mudança de status e faz fade out/in
   useEffect(() => {
      // Verifica se o status realmente mudou
      if (deployStatus !== previousStatusRef.current && deployStatus !== null) {
         previousStatusRef.current = deployStatus

         // Fade out
         setPillarOpacity(0)

         // Após fade out, troca as cores e faz fade in
         const timeout = setTimeout(() => {
            setCurrentPillarProps(targetPillarProps)
            setPillarOpacity(1)
         }, 800) // Duração do fade out

         return () => clearTimeout(timeout)
      } else if (deployStatus === null && previousStatusRef.current !== null) {
         // Reset para idle quando não há status
         previousStatusRef.current = null
         setPillarOpacity(0)
         const timeout = setTimeout(() => {
            setCurrentPillarProps(idlePillarProps)
            setPillarOpacity(1)
         }, 800)
         return () => clearTimeout(timeout)
      }
   }, [deployStatus, targetPillarProps, idlePillarProps])

   const handleDeploy = async () => {
      console.log('Deploying...')
      setLoading(true)
      setDeployStatus('building')
      
      try {         
         const { data }: { data: { projectSlug: string, url: string } } = await fetch(`${apiURL}/new-project`, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json'
            },
            body: JSON.stringify({ githubURL }),
         }).then(res => res.json())

         console.log(data)

         if (data) {
            const { projectSlug, url } = data

            setPreviewURL(url)

            console.log(`Subscribing to logs:${projectSlug}`);
            socket.emit('subscribe', `logs:${projectSlug}`)
         }
      } catch (error) {
         console.error(error)
      } finally {
         setLoading(false)
      }
   }

   const handleSocketIncommingMessage = useCallback((message: string) => {
      console.log(`[Incomming Socket Message]:`, typeof message, message)
      const data = JSON.parse(message)
      const { log, type, status } = data

      setLogs((prev) => [...prev, log])

      if (type === 'status' && status) {
         setDeployStatus(status)
      }
   }, [])

   useEffect(() => {
      socket.on('message', handleSocketIncommingMessage)

      return () => {
         socket.off('message', handleSocketIncommingMessage)
      }
   }, [handleSocketIncommingMessage])

   useEffect(() => {
      if (logsContainerRef.current) {
         logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
      }
   }, [logs])

   return (
      <div className="relative w-screen h-screen min-h-screen flex items-center justify-center">
         <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 0,
            pointerEvents: 'none',
            opacity: pillarOpacity,
            transition: 'opacity 0.8s ease-in-out'
         }}>
            <LightPillar
               topColor={currentPillarProps.topColor}
               bottomColor={currentPillarProps.bottomColor}
               intensity={currentPillarProps.intensity}
               rotationSpeed={currentPillarProps.rotationSpeed}
               glowAmount={currentPillarProps.glowAmount}
               pillarWidth={3.0}
               pillarHeight={0.4}
               noiseIntensity={0.5}
               pillarRotation={25}
               interactive={false}
               mixBlendMode={currentPillarProps.mixBlendMode}
            />
         </div>

         <div className='min-w-[700px]'>
            <div className='flex items-center justify-center gap-1'>
               <Input placeholder='GitHub Repository URL' value={githubURL} onChange={(e) => setGithubURL(e.target.value)} className={`${previewURL ? 'rounded-tl-4xl' : 'rounded-l-full'} p-8 bg-gray-600/20 backdrop-blur-sm`} />
               <Button
                  className={`${previewURL ? 'rounded-tr-4xl' : 'rounded-r-full'} p-8 ring-1 ring-gray-100/20 bg-gray-600/20 backdrop-blur-sm cursor-pointer`}
                  onClick={handleDeploy}
                  disabled={loading || !isValidURL(githubURL) || deployStatus !== null}
               >
                  {deployStatus === 'building' ? 'Building...' : deployStatus === 'success' ? 'Success!' : deployStatus === 'error' ? 'Error' : 'Deploy'}
               </Button>
            </div>
            {previewURL && (
               <div className="mt-1 bg-gray-600/20 backdrop-blur-sm ring-1 ring-gray-100/20 py-4 px-8 rounded-b-4xl">
                  <p className='text-white'>
                     Preview URL:
                     <a
                        target="_blank"
                        className={`text-sky-400 bg-sky-950 px-3 py-2 rounded-lg ml-4 ${deployStatus !== 'success' ? 'pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}
                        href={deployStatus !== 'success' ? '#' : previewURL}
                     >
                        {previewURL}
                     </a>
                  </p>
               </div>
            )}
            {logs.length > 0 && (
               <div
                  ref={logsContainerRef}
                  className={`text-sm bg-gray-600/20 backdrop-blur-sm ${deployStatus === 'success' ? 'text-green-500' : deployStatus === 'error' ? 'text-red-500' : 'text-gray-400'} logs-container mt-5 ${deployStatus === 'success' ? 'border-green-500' : deployStatus === 'error' ? 'border-red-500' : 'border-[#5227FF]'} border-2 rounded-lg p-4 h-[300px] overflow-y-auto overflow-x-hidden`}
               >
                  <pre className="flex flex-col gap-1">
                     {logs.map((log, i) => (
                        <code
                           key={i}
                        >{`> ${log}`}</code>
                     ))}
                  </pre>
               </div>
            )}
         </div>
      </div>
   )
}

export default App
