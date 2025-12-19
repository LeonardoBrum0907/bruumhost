import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import LightPillar from './components/LightPillar'
import { Input } from './components/ui/input'

function App() {
   const [count, setCount] = useState(0)

   return (
      <>
         <div className='flex flex-col items-center justify-center relative z-10 min-w-[500px]'>
            <Input placeholder='Enter your email' className='rounded-full p-8 bg-gray-600/20 backdrop-blur-sm' />
         </div>
      </>
   )
}

export default App
