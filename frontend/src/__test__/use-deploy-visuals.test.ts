import { renderHook } from "@testing-library/react"
import { useDeployVisuals } from "../hooks/useDeployVisual"
import { describe, expect, it } from "vitest"

describe('useDeployVisuals', () => {
   it('should return idle configuration when status is null', () => {
      const { result } = renderHook(() => useDeployVisuals(null))

      expect(result.current.bottomColor).toBe('#FF9FFC')
      expect(result.current.mixBlendMode).toBe('normal' as const)
      expect(result.current.intensity).toBe(1.0)
      expect(result.current.glowAmount).toBe(0.002)
      expect(result.current.rotationSpeed).toBe(0.5)
   })

   it('should return building configuration when status is building', () => {
      const { result } = renderHook(() => useDeployVisuals('building'))

      expect(result.current.bottomColor).toBe('#60A5FA')
      expect(result.current.mixBlendMode).toBe('screen' as const)
      expect(result.current.intensity).toBe(1.2)
      expect(result.current.glowAmount).toBe(0.007)
      expect(result.current.rotationSpeed).toBe(1.2)
   })

   it('should return uploading configuration when status is uploading', () => {
      const { result } = renderHook(() => useDeployVisuals('uploading'))

      expect(result.current.bottomColor).toBe('#FCD34D')
      expect(result.current.mixBlendMode).toBe('lighten')
      expect(result.current.intensity).toBe(1.1)
      expect(result.current.glowAmount).toBe(0.0025)
      expect(result.current.rotationSpeed).toBe(0.6)
   })

   it('should return success configuration when status is success', () => {
      const { result } = renderHook(() => useDeployVisuals('success'))

      expect(result.current.bottomColor).toBe('#34D399')
      expect(result.current.mixBlendMode).toBe('screen' as const)
      expect(result.current.glowAmount).toBe(0.002)
      expect(result.current.rotationSpeed).toBe(0.3)
   })

   it('should return error configuration when status is error', () => {
      const { result } = renderHook(() => useDeployVisuals('error'))

      expect(result.current.bottomColor).toBe('#F87171')
      expect(result.current.mixBlendMode).toBe('multiply' as const)
      expect(result.current.glowAmount).toBe(0.003)
      expect(result.current.rotationSpeed).toBe(0.2)
   })
})