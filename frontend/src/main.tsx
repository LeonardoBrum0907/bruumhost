import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import LightPillar from './components/LightPillar.tsx'

createRoot(document.getElementById('root')!).render(
   <StrictMode>
      <App />

      <LightPillar
         topColor="#5227FF"
         bottomColor="#FF9FFC"
         intensity={1.0}
         rotationSpeed={0.5}
         glowAmount={0.002}
         pillarWidth={3.0}
         pillarHeight={0.4}
         noiseIntensity={0.5}
         pillarRotation={25}
         interactive={false}
         mixBlendMode="normal"
      />
   </StrictMode>,
)
