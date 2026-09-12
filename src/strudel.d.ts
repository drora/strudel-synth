declare module '@strudel/web' {
  export function initStrudel(options?: {
    prebake?: () => unknown
  }): Promise<{
    evaluate: (code: string) => Promise<unknown>
  }>
  export function superdough(
    value: Record<string, unknown>,
    t: number,
    duration?: number,
  ): Promise<unknown> | unknown
  export function getAudioContext(): AudioContext
  export function initAudio(options?: Record<string, unknown>): Promise<void>
  export function getSound(s: string): { onTrigger?: unknown } | undefined
  export function registerSynthSounds(): void
  export function getSuperdoughAudioController(): {
    output?: { destinationGain?: GainNode }
  }
}

/** Subset of @strudel/mini used by the Phase 1 linter. */
declare module '@strudel/mini' {
  export function mini2ast(code: string): unknown
  export function parse(code: string): unknown
  export function mini(...args: string[]): unknown
  export class SyntaxError extends Error {
    location?: {
      start: { offset: number; line?: number; column?: number }
      end: { offset: number; line?: number; column?: number }
    }
  }
}

declare module 'superdough' {
  export function superdough(
    value: Record<string, unknown>,
    t: number,
    duration?: number,
  ): unknown
  export function getAudioContext(): AudioContext
}

declare module '@strudel/webaudio' {
  export function superdough(
    value: Record<string, unknown>,
    t: number,
    duration?: number,
  ): Promise<unknown> | unknown
  export function getAudioContext(): AudioContext
  export function initAudio(options?: Record<string, unknown>): Promise<void>
  export function getSound(s: string): { onTrigger?: unknown } | undefined
  export function getSuperdoughAudioController(): {
    output?: { destinationGain?: GainNode }
  }
}
