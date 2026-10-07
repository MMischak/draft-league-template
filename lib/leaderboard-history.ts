export type HistoryManager = {
  managerId: string
  displayName: string
  isViewer: boolean
}

export type HistoryGameweek = {
  id: string
  number: number
}

export type HistoryScore = {
  managerId: string
  gameweekId: string
  score: number
}

export type HistoryPoint = {
  gameweekId: string
  gameweekNumber: number
  score: number
  total: number
  rank: number
}

export type ManagerHistory = HistoryManager & {
  points: HistoryPoint[]
}

export function buildLeaderboardHistory(
  managers: HistoryManager[],
  gameweeks: HistoryGameweek[],
  scores: HistoryScore[],
): ManagerHistory[] {
  const scoredGameweeks = new Set(scores.map((score) => score.gameweekId))
  const visibleGameweeks = [...gameweeks]
    .filter((gameweek) => scoredGameweeks.has(gameweek.id))
    .sort((left, right) => left.number - right.number)
  const totals = new Map(managers.map((manager) => [manager.managerId, 0]))
  const histories = new Map(managers.map((manager) => [manager.managerId, { ...manager, points: [] as HistoryPoint[] }]))

  for (const gameweek of visibleGameweeks) {
    const gameweekScores = new Map(
      scores
        .filter((score) => score.gameweekId === gameweek.id)
        .map((score) => [score.managerId, Number(score.score)]),
    )

    for (const manager of managers) {
      totals.set(manager.managerId, (totals.get(manager.managerId) ?? 0) + (gameweekScores.get(manager.managerId) ?? 0))
    }

    const rankedManagers = [...managers].sort((left, right) => {
      const totalDifference = (totals.get(right.managerId) ?? 0) - (totals.get(left.managerId) ?? 0)
      return totalDifference || left.displayName.localeCompare(right.displayName)
    })
    const ranks = new Map<string, number>()
    let previousTotal: number | null = null
    let previousRank = 0

    rankedManagers.forEach((manager, index) => {
      const total = totals.get(manager.managerId) ?? 0
      if (previousTotal === null || total !== previousTotal) previousRank = index + 1
      ranks.set(manager.managerId, previousRank)
      previousTotal = total
    })

    for (const manager of managers) {
      histories.get(manager.managerId)?.points.push({
        gameweekId: gameweek.id,
        gameweekNumber: gameweek.number,
        score: gameweekScores.get(manager.managerId) ?? 0,
        total: totals.get(manager.managerId) ?? 0,
        rank: ranks.get(manager.managerId) ?? managers.length,
      })
    }
  }

  return managers.map((manager) => histories.get(manager.managerId)!)
}
