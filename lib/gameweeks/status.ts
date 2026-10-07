export type GameweekStatus = 'pending' | 'lineup' | 'live' | 'final'

export function isLineupOpen(status: string) {
  return status === 'lineup'
}

export function isLineupEditable(status: string) {
  return status === 'pending' || status === 'lineup'
}
