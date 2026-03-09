import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi } from 'vitest'

interface WithSocketCallback {
   __socketMessageCallback?: (message: unknown) => void;
   __socketEmitSpy?: (...args: unknown[]) => void;
}

export type GlobalThis = typeof globalThis & WithSocketCallback;

// Mock socket.io-client globally so all tests get the mocked implementation
vi.mock('socket.io-client', () => {
  return {
    io: vi.fn(() => ({
      on: (event: string, cb: (message: unknown) => void) => {
        if (event === 'message') {
          ;(globalThis as GlobalThis).__socketMessageCallback = cb
        }
      },
      off: vi.fn(),
      emit: vi.fn((...args: unknown[]) => {
        ;(globalThis as GlobalThis).__socketEmitSpy = (globalThis as GlobalThis).__socketEmitSpy || vi.fn()
        ;(globalThis as GlobalThis).__socketEmitSpy?.(...args)
      }),
    })),
  }
})

afterEach(() => {
   cleanup()
})