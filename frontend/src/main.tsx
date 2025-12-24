import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import LightPillar from './components/LightPillar.tsx'

createRoot(document.getElementById('root')!).render(
   <StrictMode>
      <App />
   </StrictMode>,
)
