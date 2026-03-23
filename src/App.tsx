import { useEffect } from 'react'
import { AppShell } from './components/layout/AppShell'
import { registerWebMCPTools } from './engine/webmcp'

export default function App() {
  useEffect(() => {
    registerWebMCPTools()
  }, [])

  return <AppShell />
}
