import { useMemo, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import LightPillar from './components/LightPillar'
import { Input } from './components/ui/input'
import { Button } from './components/ui/button'

function App() {
   const [githubURL, setGithubURL] = useState('')
   const [slug, setSlug] = useState('')
   const [previewURL, setPreviewURL] = useState('')
   const [loading, setLoading] = useState(false)

   const isValidURL: [boolean, string | null] = useMemo(() => {
      if (!githubURL) return [false, null]

      const githubURLRegex = new RegExp(
         /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/)?$/
      )

      return [githubURLRegex.test(githubURL), 'Invalid GitHub repository URL']
   }, [githubURL])

   const handleDeploy = async () => {
      console.log('Deploying...')
      setLoading(true)
      try {
         const { data } : { data: { projectSlug: string, url: string } } = await fetch('http://localhost:9000/new-project', {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json'
            },
            body: JSON.stringify({ githubURL }),
         }).then(res => res.json())

         console.log(data)
         setSlug(data.projectSlug)
         setPreviewURL(data.url)
      } catch (error) {
         console.error(error)
      } finally { 
         console.log('finished')
         setLoading(false)
      }
   }

   return (
      <>
         <div className='flex items-center justify-center gap-1 relative z-10 min-w-[700px]'>
            <Input placeholder='GitHub Repository URL' value={githubURL} onChange={(e) => setGithubURL(e.target.value)} className='rounded-l-full p-8 bg-gray-600/20 backdrop-blur-sm' />
            <Button className='rounded-r-full p-8 ring-1 ring-gray-100/20 bg-gray-600/20 backdrop-blur-sm cursor-pointer' onClick={handleDeploy} disabled={loading || !isValidURL[0]}>Deploy</Button>
         </div>
      </>
   )
}

export default App
