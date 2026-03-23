import { useState, useRef, useCallback, useEffect } from 'react'
import { useSessionStore } from '../../store/session-store'
import { ROLE_PRESETS } from '../../engine/presets'

type RecordingState = 'idle' | 'recording' | 'recorded'

export function VoiceRecorder() {
  const [state, setState] = useState<RecordingState>('idle')
  const [sampleName, setSampleName] = useState('vox')
  const [duration, setDuration] = useState(0)
  const [waveformData, setWaveformData] = useState<number[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const blobRef = useRef<Blob | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)
  const startTimeRef = useRef(0)
  const addTrack = useSessionStore((s) => s.addTrack)

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      // Set up analyser for waveform visualization
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        blobRef.current = blob
        stream.getTracks().forEach((t) => t.stop())
        setState('recorded')
      }

      mediaRecorder.start(100)
      startTimeRef.current = Date.now()
      setState('recording')

      // Animate waveform
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const drawWaveform = () => {
        analyser.getByteTimeDomainData(dataArray)
        const samples = Array.from(dataArray).map((v) => (v - 128) / 128)
        setWaveformData(samples)
        setDuration((Date.now() - startTimeRef.current) / 1000)
        animFrameRef.current = requestAnimationFrame(drawWaveform)
      }
      drawWaveform()
    } catch (err) {
      console.error('Mic access denied:', err)
    }
  }, [])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    cancelAnimationFrame(animFrameRef.current)
  }, [])

  const saveToSession = useCallback(async () => {
    if (!blobRef.current) return
    const url = URL.createObjectURL(blobRef.current)

    // Register with Strudel
    try {
      // @ts-expect-error registerSound is a Strudel global
      if (typeof globalThis.registerSound === 'function') {
        // @ts-expect-error
        globalThis.registerSound(sampleName, () => url)
      }
    } catch {
      // Fallback: just create the track with code referencing the sample
    }

    const preset = ROLE_PRESETS.vox
    addTrack({
      name: sampleName,
      role: 'vox',
      code: `s("${sampleName}").loopAt(2).room(0.3)`,
      color: preset.color,
      muted: false,
      soloed: false,
      locked: false,
      volume: 1,
      error: null,
    })

    setState('idle')
    setWaveformData([])
    setDuration(0)
    blobRef.current = null
  }, [sampleName, addTrack])

  const preview = useCallback(() => {
    if (!blobRef.current) return
    const url = URL.createObjectURL(blobRef.current)
    const audio = new Audio(url)
    audio.play()
  }, [])

  useEffect(() => {
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [])

  return (
    <div className="bg-bg-surface border-t border-border px-3 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">Voice Recorder</span>
        {state === 'recording' && (
          <span className="text-[10px] text-error animate-pulse">REC {duration.toFixed(1)}s</span>
        )}
      </div>

      {/* Waveform display */}
      {(state === 'recording' || state === 'recorded') && (
        <div className="h-12 bg-bg-elevated rounded mb-2 overflow-hidden">
          <svg width="100%" height="100%" viewBox="0 0 200 48" preserveAspectRatio="none">
            <path
              d={waveformData
                .map((v, i) => {
                  const x = (i / waveformData.length) * 200
                  const y = 24 + v * 20
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
                })
                .join(' ')}
              fill="none"
              stroke={state === 'recording' ? '#ef4444' : '#a78bfa'}
              strokeWidth={1.5}
            />
          </svg>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        {state === 'idle' && (
          <button
            onClick={startRecording}
            className="flex items-center gap-1 px-3 py-1.5 bg-error/20 text-error rounded text-xs hover:bg-error/30 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-error" />
            Record
          </button>
        )}
        {state === 'recording' && (
          <button
            onClick={stopRecording}
            className="flex items-center gap-1 px-3 py-1.5 bg-bg-elevated text-text rounded text-xs hover:bg-border transition-colors"
          >
            ■ Stop
          </button>
        )}
        {state === 'recorded' && (
          <>
            <button
              onClick={preview}
              className="px-2 py-1 text-xs text-text-muted hover:text-text bg-bg-elevated rounded transition-colors"
            >
              Preview
            </button>
            <input
              type="text"
              value={sampleName}
              onChange={(e) => setSampleName(e.target.value)}
              className="w-20 px-2 py-1 bg-bg-elevated border border-border rounded text-xs text-text font-mono focus:outline-none focus:border-accent"
              placeholder="Name"
            />
            <button
              onClick={saveToSession}
              className="px-3 py-1 text-xs bg-accent/20 text-accent rounded hover:bg-accent/30 transition-colors"
            >
              Add Track
            </button>
            <button
              onClick={() => { setState('idle'); setWaveformData([]); setDuration(0) }}
              className="px-2 py-1 text-xs text-text-muted hover:text-error transition-colors"
            >
              Discard
            </button>
          </>
        )}
      </div>
    </div>
  )
}
