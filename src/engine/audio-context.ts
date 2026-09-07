let audioCtx: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

export function getAudioContextState(): AudioContextState | 'missing' {
  return audioCtx?.state ?? 'missing'
}

export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
}
