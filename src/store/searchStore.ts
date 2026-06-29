import { create } from 'zustand'

interface SearchStore {
  isOpen: boolean
  query: string
  setQuery: (q: string) => void
  toggle: () => void
  open: () => void
  close: () => void
}

export const useSearchStore = create<SearchStore>((set) => ({
  isOpen: false,
  query: '',
  setQuery: (q) => set({ query: q }),
  toggle:   () => set((s) => ({ isOpen: !s.isOpen })),
  open:     () => set({ isOpen: true }),
  close:    () => set({ isOpen: false, query: '' }),
}))
