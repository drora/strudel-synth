export type WebMcpRegister = (def: Record<string, unknown>) => void

import { KITS } from './kits'

type LogEntry = {
  timestamp: number
  tool: string
  params: Record<string, unknown>
  result: string
  status: 'success' | 'error'
}

const activityLog: LogEntry[] = []
const listeners: Set<() => void> = new Set()

function logActivity(entry: LogEntry) {
  activityLog.unshift(entry)
  if (activityLog.length > 100) activityLog.pop()
  listeners.forEach((fn) => fn())
}

export function getActivityLog(): LogEntry[] {
  return activityLog
}

export function onActivityLogChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function toolResult(text: string) {
  return { content: [{ type: 'text' as const, text }] }
}

export function ok(tool: string, params: Record<string, unknown>, payload: unknown, summary = 'ok') {
  logActivity({ timestamp: Date.now(), tool, params, result: summary, status: 'success' })
  return toolResult(JSON.stringify(payload, null, 2))
}

export function fail(tool: string, params: Record<string, unknown>, error: string) {
  logActivity({ timestamp: Date.now(), tool, params, result: error, status: 'error' })
  return toolResult(JSON.stringify({ status: 'error', error }, null, 2))
}

export function kitBanksList(): string[] {
  const banks = new Set<string>()
  for (const k of KITS) banks.add(k.drumsBank)
  return [...banks].sort()
}

export function okText(tool: string, params: Record<string, unknown>, text: string, summary = 'ok') {
  logActivity({ timestamp: Date.now(), tool, params, result: summary, status: 'success' })
  return toolResult(text)
}
