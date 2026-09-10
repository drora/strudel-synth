import { getActivityLog, onActivityLogChange, type WebMcpRegister } from './webmcp-helpers'
import { registerWebMcpToolsA } from './webmcp-tools-a'
import { registerWebMcpToolsB } from './webmcp-tools-b'

export { getActivityLog, onActivityLogChange }

export function registerWebMCPTools() {
  if (!('modelContext' in navigator)) {
    console.log('[WebMCP] navigator.modelContext not available — tools not registered')
    return
  }

  const mc = (navigator as any).modelContext
  let toolCount = 0
  const register: WebMcpRegister = (def) => {
    mc.registerTool(def)
    toolCount++
  }

  registerWebMcpToolsA(register)
  registerWebMcpToolsB(register)

  console.log(`[WebMCP] Registered ${toolCount} tools with navigator.modelContext`)
}
