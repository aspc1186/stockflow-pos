import { createContext, useContext, ReactNode } from 'react'

interface SocketCtx {
  connected: boolean
  on: (e: string, cb: (d: unknown) => void) => void
  off: (e: string, cb: (d: unknown) => void) => void
  emit: (e: string, d?: unknown) => void
}

const SocketContext = createContext<SocketCtx>({ connected: false, on: () => {}, off: () => {}, emit: () => {} })

export function SocketProvider({ children }: { children: ReactNode }) {
  return (
    <SocketContext.Provider value={{ connected: false, on: () => {}, off: () => {}, emit: () => {} }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() { return useContext(SocketContext) }
