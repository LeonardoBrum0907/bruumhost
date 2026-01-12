import { useMemo } from "react"

export type DeplyStatus = 'idle' | 'building' | 'uploading' | 'success' | 'error'

export const useDeployVisuals = (status: DeplyStatus | null) => {
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