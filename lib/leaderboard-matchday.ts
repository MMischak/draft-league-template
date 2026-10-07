export type MatchdayManager = {
  managerId: string
  displayName: string
  score: number
  isViewer: boolean
}

export type MatchdayLineup = {
  managerId: string
  players: Array<{
    playerId: string
    clubCode: string
    isStarter: boolean
  }>
}

export type MatchdayFixture = {
  homeClubCode: string
  awayClubCode: string
  kickoffAt: string
  finished: boolean
}

export type MatchdayRow = MatchdayManager & {
  rank: number
  remainingPlayers: number
}

export function buildCurrentMatchdayRows(
  managers: MatchdayManager[],
  lineups: MatchdayLineup[],
  fixtures: MatchdayFixture[],
  nowMs = Date.now(),
): MatchdayRow[] {
  const clubsWithOpenFixtures = new Set(
    fixtures
      .filter((fixture) => {
        if (fixture.finished) return false
        const kickoffMs = Date.parse(fixture.kickoffAt)
        return !Number.isFinite(kickoffMs) || kickoffMs + 3 * 60 * 60 * 1000 > nowMs
      })
      .flatMap((fixture) => [fixture.homeClubCode, fixture.awayClubCode]),
  )
  const lineupByManager = new Map(lineups.map((lineup) => [lineup.managerId, lineup.players]))

  const rows = managers.map((manager) => {
    const remainingPlayerIds = new Set(
      (lineupByManager.get(manager.managerId) ?? [])
        .filter((player) => player.isStarter && clubsWithOpenFixtures.has(player.clubCode))
        .map((player) => player.playerId),
    )

    return { ...manager, remainingPlayers: remainingPlayerIds.size }
  }).sort((left, right) => right.score - left.score || left.displayName.localeCompare(right.displayName))

  let lastScore: number | null = null
  let lastRank = 0
  return rows.map((row, index) => {
    if (lastScore === null || row.score !== lastScore) lastRank = index + 1
    lastScore = row.score
    return { ...row, rank: lastRank }
  })
}
