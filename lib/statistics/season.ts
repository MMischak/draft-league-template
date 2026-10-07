import type { Json } from '@/lib/supabase/database.types'

export type LineupRecord = {
  managerId: string
  managerName: string
  gameweekNumber: number
  score: number
}

export type ManagerSeasonStat = {
  managerId: string
  managerName: string
  played: number
  total: number
  average: number
  benchPoints: number
  efficiency: number
  deviation: number
  wins: number
}

export type PlayerSeasonStat = {
  playerId: string
  playerName: string
  clubCode: string
  position: string
  managerId: string
  managerName: string
  points: number
  gameweeks: number
}

export type ManagerRecord = {
  managerId: string
  managerName: string
  value: number
}

export type PlayerGameweekRecord = {
  playerId: string
  playerName: string
  clubCode: string
  managerId: string
  managerName: string
  gameweekNumber: number
  score: number
}

export type SeasonStatistics = {
  managerCount: number
  playedGameweeks: number
  scoredLineups: number
  topLineups: LineupRecord[]
  bottomLineups: LineupRecord[]
  managers: ManagerSeasonStat[]
  players: PlayerSeasonStat[]
  records: {
    mostWins: ManagerRecord | null
    mostConsistent: ManagerRecord | null
    bestPlayerGameweek: PlayerGameweekRecord | null
  }
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function list(value: unknown) {
  return Array.isArray(value) ? value : []
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function number(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function managerRecord(value: unknown): ManagerRecord | null {
  if (!value) return null
  const item = record(value)
  const managerId = text(item.managerId)
  if (!managerId) return null
  return { managerId, managerName: text(item.managerName), value: number(item.value) }
}

export function parseSeasonStatistics(value: Json | null): SeasonStatistics {
  const data = record(value)
  const records = record(data.records)
  const bestPlayer = record(records.bestPlayerGameweek)

  return {
    managerCount: number(data.managerCount),
    playedGameweeks: number(data.playedGameweeks),
    scoredLineups: number(data.scoredLineups),
    topLineups: list(data.topLineups).map((value) => {
      const item = record(value)
      return { managerId: text(item.managerId), managerName: text(item.managerName), gameweekNumber: number(item.gameweekNumber), score: number(item.score) }
    }),
    bottomLineups: list(data.bottomLineups).map((value) => {
      const item = record(value)
      return { managerId: text(item.managerId), managerName: text(item.managerName), gameweekNumber: number(item.gameweekNumber), score: number(item.score) }
    }),
    managers: list(data.managers).map((value) => {
      const item = record(value)
      return {
        managerId: text(item.managerId),
        managerName: text(item.managerName),
        played: number(item.played),
        total: number(item.total),
        average: number(item.average),
        benchPoints: number(item.benchPoints),
        efficiency: number(item.efficiency),
        deviation: number(item.deviation),
        wins: number(item.wins),
      }
    }),
    players: list(data.players).map((value) => {
      const item = record(value)
      return {
        playerId: text(item.playerId),
        playerName: text(item.playerName),
        clubCode: text(item.clubCode),
        position: text(item.position),
        managerId: text(item.managerId),
        managerName: text(item.managerName),
        points: number(item.points),
        gameweeks: number(item.gameweeks),
      }
    }),
    records: {
      mostWins: managerRecord(records.mostWins),
      mostConsistent: managerRecord(records.mostConsistent),
      bestPlayerGameweek: text(bestPlayer.playerId) ? {
        playerId: text(bestPlayer.playerId),
        playerName: text(bestPlayer.playerName),
        clubCode: text(bestPlayer.clubCode),
        managerId: text(bestPlayer.managerId),
        managerName: text(bestPlayer.managerName),
        gameweekNumber: number(bestPlayer.gameweekNumber),
        score: number(bestPlayer.score),
      } : null,
    },
  }
}
