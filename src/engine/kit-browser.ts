import { KITS, VIBES, type Kit, type VibeId } from './kits'

/** Short display names for drum banks used as soft tags / list meta. */
const BANK_SHORT: Record<string, string> = {
  RolandTR909: '909',
  RolandTR808: '808',
  RolandTR707: '707',
  RolandTR606: '606',
  RolandTR505: '505',
  RolandTR727: '727',
  LinnDrum: 'Linn',
  LinnLM1: 'LM-1',
  RolandCompurhythm78: 'CR78',
  AkaiMPC60: 'MPC60',
  EmuSP12: 'SP-12',
  BossDR110: 'DR-110',
  OberheimDMX: 'DMX',
  CasioRZ1: 'RZ1',
}

export type TempoBand = 'slow' | 'mid' | 'fast'

export type SoftTagKind = 'tempo' | 'bank' | 'vibe'

export interface SoftTag {
  id: string
  kind: SoftTagKind
  label: string
}

export function drumsBankShortName(bank: string): string {
  return BANK_SHORT[bank] ?? bank.replace(/^Roland/, '').replace(/Compurhythm/, 'CR')
}

export function kitTempoBand(bpm: number): TempoBand {
  if (bpm < 100) return 'slow'
  if (bpm > 140) return 'fast'
  return 'mid'
}

const TEMPO_TAGS: SoftTag[] = [
  { id: 'tempo:slow', kind: 'tempo', label: 'Slow' },
  { id: 'tempo:mid', kind: 'tempo', label: 'Mid' },
  { id: 'tempo:fast', kind: 'tempo', label: 'Fast' },
]

/** Soft tags derived from kit catalog (tempo bands + banks + former vibes). */
export function listKitSoftTags(kits: Kit[] = KITS): SoftTag[] {
  const banks = new Map<string, SoftTag>()
  for (const k of kits) {
    const short = drumsBankShortName(k.drumsBank)
    if (!banks.has(short)) {
      banks.set(short, { id: `bank:${short}`, kind: 'bank', label: short })
    }
  }
  const vibeTags: SoftTag[] = VIBES.map((v) => ({
    id: `vibe:${v.id}`,
    kind: 'vibe',
    label: v.label,
  }))
  return [
    ...TEMPO_TAGS,
    ...[...banks.values()].sort((a, b) => a.label.localeCompare(b.label)),
    ...vibeTags,
  ]
}

export function filterKits(
  kits: Kit[],
  opts: { search?: string; tags?: string[] },
): Kit[] {
  const q = (opts.search ?? '').trim().toLowerCase()
  const tags = opts.tags ?? []
  const tempoTags = tags.filter((t) => t.startsWith('tempo:'))
  const bankTags = tags.filter((t) => t.startsWith('bank:'))
  const vibeTags = tags.filter((t) => t.startsWith('vibe:'))

  return kits.filter((kit) => {
    if (tempoTags.length) {
      const band = kitTempoBand(kit.bpm)
      if (!tempoTags.includes(`tempo:${band}`)) return false
    }
    if (bankTags.length) {
      const short = drumsBankShortName(kit.drumsBank)
      if (!bankTags.includes(`bank:${short}`)) return false
    }
    if (vibeTags.length) {
      if (!vibeTags.includes(`vibe:${kit.vibe}`)) return false
    }
    if (!q) return true
    const hay = [
      kit.name,
      kit.description,
      kit.drumsBank,
      drumsBankShortName(kit.drumsBank),
      kit.vibe,
      String(kit.bpm),
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

/** Pick a random kit from list, preferring one other than `excludeId`. */
export function pickRandomKit(kits: Kit[], excludeId?: string | null): Kit | undefined {
  if (kits.length === 0) return undefined
  const others = excludeId ? kits.filter((k) => k.id !== excludeId) : kits
  const pool = others.length > 0 ? others : kits
  return pool[Math.floor(Math.random() * pool.length)]
}

export function vibeLabel(id: VibeId): string {
  return VIBES.find((v) => v.id === id)?.label ?? id
}
