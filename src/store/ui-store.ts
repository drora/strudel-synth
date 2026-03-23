import { create } from 'zustand'

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
  mode: 'beginner' | 'producer'
  sampleLoading: SampleLoadingState
  setShowTemplateModal: (show: boolean) => void
  setMode: (mode: 'beginner' | 'producer') => void
  setSampleLoadingTotal: (total: number) => void
  onBankLoaded: (success: boolean) => void
  setSampleLoadingDone: () => void
}

export const useUIStore = create<UIState>((set) => ({
  showTemplateModal: true,
  mode: 'beginner',
  sampleLoading: { totalBanks: 0, loadedBanks: 0, failedBanks: 0, done: false },
  setShowTemplateModal: (showTemplateModal) => set({ showTemplateModal }),
  setMode: (mode) => set({ mode }),
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
}))
