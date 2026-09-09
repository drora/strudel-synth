declare module '@strudel/web' {
  export function initStrudel(options?: {
    prebake?: () => unknown
  }): Promise<{
    evaluate: (code: string) => Promise<unknown>
  }>
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
