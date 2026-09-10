import type { WebMcpRegister } from './webmcp-helpers'
import { registerWebMcpToolsA1 } from './webmcp-tools-a1'
import { registerWebMcpToolsA2 } from './webmcp-tools-a2'

export function registerWebMcpToolsA(register: WebMcpRegister) {
  registerWebMcpToolsA1(register)
  registerWebMcpToolsA2(register)
}
