import App from "@/App";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock('socket.io-client', () => ({
   io: vi.fn(() => ({
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
   }))
}))

vi.mock('@/components/LightPillar', () => ({
   default: () => <div data-testid="light-pillar-mock" />
}))

globalThis.fetch = vi.fn()

describe('AppPage', () => {
   beforeEach(() => {
      vi.clearAllMocks()
   })

   it('should render input and deploy button', () => {
      render(<App />)

      const input = screen.getByPlaceholderText('GitHub Repository URL')
      const button = screen.getByRole('button', { name: 'Deploy' })

      expect(input).toBeInTheDocument()
      expect(button).toBeInTheDocument()
   })

   it('button should be disabled initally', () => {
      render(<App />)

      const button = screen.getByRole('button', { name: 'Deploy' })

      expect(button).toBeDisabled()
   })

   it('should enable button with valid GitHub URL', async () => {
      render(<App />)

      const input = screen.getByPlaceholderText('GitHub Repository URL')
      const button = screen.getByRole('button', { name: 'Deploy' })

      await userEvent.type(input, 'https://github.com/user/repo')

      expect(button).not.toBeDisabled()
   })

   it('should keep button disabled with invalid URL', async () => {
      render(<App />)

      const input = screen.getByPlaceholderText('GitHub Repository URL')
      const button = screen.getByRole('button', { name: 'Deploy' })

      await userEvent.type(input, 'invalid-url')

      expect(button).toBeDisabled()
   })
})