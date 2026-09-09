import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Quantization } from '../engine/live-update'

interface SampleLoadingState {
  /** Total number of community sample banks */
  totalBanks: number
  /** Number of banks loaded so far */
  loadedBanks: number
  /** Number of banks that failed */
  failedBanks: number
  /** Whether loading is complete */
  done: boolean
}

interface UIState {
  showTemplateModal: boolean
  appMode: 'studio' | 'learn'
  sampleLoading: SampleLoadingState

  /** Global default live-update quantization (persisted). */
  defaultQuantization: Quantization
  /** Optional per-track overrides; missing key → use defaultQuantization. */
  trackQuantization: Record<string, Quantization>
  /**
   * Crossfade on pattern swap — STUBBED / always false.
   * Strudel exposes top-level `xfade(left, amount, right)` for concurrent blend,
   * not a safe evaluate()/compose swap transition. Do not invent a broken wrap.
   */
  crossfadeSwaps: boolean
  /** Phase 5: keep trailing effect chain (.lpf/.room/…) when reshuffling. */
  pinEffects: boolean

  setShowTemplateModal: (show: boolean) => void
  setAppMode: (mode: 'studio' | 'learn') => void
  setSampleLoadingTotal: (total: number) => void
  onBankLoaded: (success: boolean) => void
  setSampleLoadingDone: () => void

  setDefaultQuantization: (q: Quantization) => void
  setTrackQuantization: (trackId: string, q: Quantization | null) => void
  getEffectiveQuantization: (trackId?: string | null) => Quantization
  /** No-op enabler — crossfade remains disabled until a real swap API exists. */
  setCrossfadeSwaps: (enabled: boolean) => void
  setPinEffects: (enabled: boolean) => void
}

const QUANT_VALUES: Quantization[] = ['immediate', '1', '2', '4']

function isQuantization(v: unknown): v is Quantization {
  return typeof v === 'string' && (QUANT_VALUES as string[]).includes(v)
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      showTemplateModal: true,
      appMode: 'studio',
      sampleLoading: { totalBanks: 0, loadedBanks: 0, failedBanks: 0, done: false },

      defaultQuantization: '1',
      trackQuantization: {},
      crossfadeSwaps: false,
      pinEffects: false,

      setShowTemplateModal: (showTemplateModal) => set({ showTemplateModal }),
      setAppMode: (appMode) => set({ appMode }),
      setSampleLoadingTotal: (total) =>
        set((s) => ({ sampleLoading: { ...s.sampleLoading, totalBanks: total } })),
      onBankLoaded: (success) =>
        set((s) => ({
          sampleLoading: {
            ...s.sampleLoading,
            loadedBanks: s.sampleLoading.loadedBanks + 1,
            failedBanks: s.sampleLoading.failedBanks + (success ? 0 : 1),
          },
        })),
      setSampleLoadingDone: () =>
        set((s) => ({ sampleLoading: { ...s.sampleLoading, done: true } })),

      setDefaultQuantization: (defaultQuantization) => set({ defaultQuantization }),

      setTrackQuantization: (trackId, q) =>
        set((s) => {
          const next = { ...s.trackQuantization }
          if (q == null) delete next[trackId]
          else next[trackId] = q
          return { trackQuantization: next }
        }),

      getEffectiveQuantization: (trackId) => {
        const s = get()
        if (trackId && s.trackQuantization[trackId]) {
          return s.trackQuantization[trackId]
        }
        return s.defaultQuantization
      },

      // Intentionally ignore `enabled: true` — see crossfadeSwaps comment.
      setCrossfadeSwaps: (_enabled) => set({ crossfadeSwaps: false }),

      setPinEffects: (pinEffects) => set({ pinEffects }),
    }),
    {
      name: 'strudel-studio-ui',
      partialize: (s) => ({
        defaultQuantization: s.defaultQuantization,
        pinEffects: s.pinEffects,
        // track overrides are session-local; only persist global default
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<UIState>
        return {
          ...current,
          ...p,
          defaultQuantization: isQuantization(p.defaultQuantization)
            ? p.defaultQuantization
            : current.defaultQuantization,
          pinEffects: typeof p.pinEffects === 'boolean' ? p.pinEffects : current.pinEffects,
          // never hydrate crossfade on
          crossfadeSwaps: false,
        }
      },
    },
  ),
)

export const QUANT_OPTIONS: { value: Quantization; label: string; short: string }[] = [
  { value: '1', label: '1 cycle (the one)', short: '1' },
  { value: '2', label: '2 cycles', short: '2' },
  { value: '4', label: '4 cycles', short: '4' },
  { value: 'immediate', label: 'Immediate', short: '∞' },
]
