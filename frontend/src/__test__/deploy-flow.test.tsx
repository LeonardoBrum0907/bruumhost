// Montar a App com render(<App />)
// Digitar a URL com userEvent.type
// Preparar o mock do fetch para retornar dados co projectSlug e url
// Clicar em Deploy
// Aguardar (waitFor) o fetch e a chamada do socket.emit
// Recuperar a instância de socket mockada (a partir do mock io) para verificar emit
// Invocar o callback capturado para simular mensagens de socket (status + logs)
// Usar waitFor para verificar estados/DOM atualizados

// socket callback will be provided via globalThis.__socketMessageCallback from setup mock

import App from "@/App";
import type { GlobalThis } from "@/tests/setup";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

describe('Deploy Flow', () => {
   beforeEach(() => {
      vi.clearAllMocks()
      // clear any global socket callback set by setup mock
      ;(globalThis as GlobalThis).__socketMessageCallback = undefined
      globalThis.fetch = vi.fn()
   })

   it('should call fetch, socket.emit and update state correctly', async () => {
      render(<App />)

      const input = screen.getByPlaceholderText('GitHub Repository URL')
      const button = screen.getByRole('button', { name: 'Deploy'})

      await userEvent.type(input, 'https://github.com/user/repo')

      const mockSlug = "project-slug";
      const mockPreviewURL = "https://project-url.com";
      (globalThis.fetch as unknown as unknown as Mock).mockResolvedValueOnce({
         json: async () => ({ data: { projectSlug: mockSlug, url: mockPreviewURL } })
      })

      await userEvent.click(button)
      await waitFor(() => {
         expect(globalThis.fetch).toHaveBeenCalled()
      })

      // assert that the mocked socket emit was called via the global spy set in setup
      const emitSpy = (globalThis as GlobalThis).__socketEmitSpy
      expect(emitSpy).toBeDefined()
      expect(emitSpy).toHaveBeenCalledWith('subscribe', `logs:${mockSlug}`)

      const msgBuilding = JSON.stringify({ log: 'build started', type: 'status', status: 'building' })
      // use the global callback set by the setup mock
      const globalCb = (globalThis as GlobalThis).__socketMessageCallback
      expect(globalCb).toBeDefined()
      globalCb?.(msgBuilding)

      await waitFor(() => {
         expect(screen.getByText('> build started')).toBeInTheDocument()
         expect(screen.getByRole('button')).toHaveTextContent('Building...')
      })

      const msgSuccess = JSON.stringify({ log: 'build finished', type: 'status', status: 'success' })
      globalCb?.(msgSuccess)

      await waitFor(() => {
         expect(screen.getByText('> build finished')).toBeInTheDocument()
         expect(screen.getByRole('button')).toHaveTextContent('Success!')
         
         const link = screen.getByText(mockPreviewURL) as HTMLAnchorElement
         expect(link).toBeInTheDocument()
         expect(link.getAttribute('href')).toBe(mockPreviewURL)
      })
   })

   it('should handle fetch error by resetting loading and showing error state', async () => {
      render(<App />)

      const input = screen.getByPlaceholderText('GitHub Repository URL')
      const button = screen.getByRole('button', { name: 'Deploy'})

      await userEvent.type(input, 'https://github.com/user/repo')

      ;(globalThis.fetch as unknown as Mock).mockRejectedValueOnce(new Error('Network error'))

      await userEvent.click(button)

      
      await waitFor(() => {
         expect(button).toBeDisabled()
         expect(button).toHaveTextContent('Error')
      })

   })

   it('should parse socket messages and update logs and deployStatus', async () => {
      render(<App />)

      const globalCb = (globalThis as GlobalThis).__socketMessageCallback
      expect (globalCb).toBeDefined()

      globalCb?.(JSON.stringify({ log: 'upload started', type: 'status', status: 'uploading' }))

      await waitFor(() => {
         expect(screen.getByText('> upload started')).toBeInTheDocument()
         expect(screen.getByRole('button')).toHaveTextContent('Deploy')
      })

      globalCb?.(JSON.stringify({ log: 'build started', type: 'status', status: 'building' }))

      await waitFor(() => {
         expect(screen.getByText('> build started')).toBeInTheDocument()
         expect(screen.getByRole('button')).toHaveTextContent('Building...')
      })

      globalCb?.(JSON.stringify({ log: 'done', type: 'status', status: 'success' }))

      await waitFor(() => {
         expect(screen.getByText('> done')).toBeInTheDocument()
         expect(screen.getByRole('button')).toHaveTextContent('Success!')
      })

      globalCb?.(JSON.stringify({ log: 'failed', type: 'status', status: 'error' }))

      await waitFor(() => {
         expect(screen.getByText('> failed')).toBeInTheDocument()
         expect(screen.getByRole('button')).toHaveTextContent('Error')
      })
   })

   it('should ignore invalid socket payloads without crashing', async () => {
      render(<App />)

      const globalCb = (globalThis as GlobalThis).__socketMessageCallback
      expect(globalCb).toBeDefined()

      expect(() => {
         globalCb?.('NOT_JSON')
      }).not.toThrow()

      expect(screen.queryByText(/^> /)).not.toBeInTheDocument()
   })
})