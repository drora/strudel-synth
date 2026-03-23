declare module '@strudel/web' {
  export function initStrudel(options?: {
    prebake?: () => unknown
  }): Promise<{
    evaluate: (code: string) => Promise<unknown>
  }>
}
