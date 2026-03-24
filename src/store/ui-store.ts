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
  appMode: 'studio' | 'learn'
  sampleLoading: SampleLoadingState
  setShowTemplateModal: (show: boolean) => void
  setAppMode: (mode: 'studio' | 'learn') => void
  setSampleLoadingTotal: (total: number) => void
  onBankLoaded: (success: boolean) => void
  setSampleLoadingDone: () => void
}

export const useUIStore = create<UIState>((set) => ({
  showTemplateModal: true,
  appMode: 'studio',
  sampleLoading: { totalBanks: 0, loadedBanks: 0, failedBanks: 0, done: false },
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
}))
