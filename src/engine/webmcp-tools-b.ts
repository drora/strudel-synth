import type { WebMcpRegister } from './webmcp-helpers'
import { registerWebMcpToolsB1 } from './webmcp-tools-b1'
import { registerWebMcpToolsB2 } from './webmcp-tools-b2'

export function registerWebMcpToolsB(register: WebMcpRegister) {
  registerWebMcpToolsB1(register)
  registerWebMcpToolsB2(register)
}
