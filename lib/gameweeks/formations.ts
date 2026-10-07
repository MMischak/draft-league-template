export type LineupPosition = 'GK' | 'DEF' | 'MID' | 'FWD'

export type FormationId = '3-4-3' | '3-5-2' | '4-3-3' | '4-4-2' | '4-5-1' | '5-2-3' | '5-3-2' | '5-4-1'

export type LineupSlots = Record<LineupPosition, Array<string | null>>

export const FORMATIONS: Array<{ id: FormationId } & Record<LineupPosition, number>> = [
  { id: '3-4-3', GK: 1, DEF: 3, MID: 4, FWD: 3 },
  { id: '3-5-2', GK: 1, DEF: 3, MID: 5, FWD: 2 },
  { id: '4-3-3', GK: 1, DEF: 4, MID: 3, FWD: 3 },
  { id: '4-4-2', GK: 1, DEF: 4, MID: 4, FWD: 2 },
  { id: '4-5-1', GK: 1, DEF: 4, MID: 5, FWD: 1 },
  { id: '5-2-3', GK: 1, DEF: 5, MID: 2, FWD: 3 },
  { id: '5-3-2', GK: 1, DEF: 5, MID: 3, FWD: 2 },
  { id: '5-4-1', GK: 1, DEF: 5, MID: 4, FWD: 1 },
]

const DEFAULT_FORMATION: FormationId = '4-4-2'
const POSITIONS: LineupPosition[] = ['GK', 'DEF', 'MID', 'FWD']

export function getFormation(id: FormationId) {
  return FORMATIONS.find((formation) => formation.id === id) ?? FORMATIONS[3]
}

export function inferFormation(positions: string[]): FormationId {
  const counts = Object.fromEntries(POSITIONS.map((position) => [position, positions.filter((value) => value === position).length])) as Record<LineupPosition, number>
  return FORMATIONS.find((formation) => POSITIONS.every((position) => formation[position] === counts[position]))?.id ?? DEFAULT_FORMATION
}

export function createLineupSlots(formationId: FormationId, players: Array<{ id: string; position: string }>): LineupSlots {
  const formation = getFormation(formationId)
  return Object.fromEntries(POSITIONS.map((position) => {
    const ids = players.filter((player) => player.position === position).map((player) => player.id).slice(0, formation[position])
    return [position, [...ids, ...Array<string | null>(formation[position] - ids.length).fill(null)]]
  })) as LineupSlots
}

export function resizeLineupSlots(slots: LineupSlots, formationId: FormationId): LineupSlots {
  const formation = getFormation(formationId)
  return Object.fromEntries(POSITIONS.map((position) => [
    position,
    [...slots[position].slice(0, formation[position]), ...Array<string | null>(Math.max(0, formation[position] - slots[position].length)).fill(null)],
  ])) as LineupSlots
}

export function selectedLineupIds(slots: LineupSlots) {
  return POSITIONS.flatMap((position) => slots[position]).filter((id): id is string => Boolean(id))
}
