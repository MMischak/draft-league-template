export type MatchdayFixture = {
  id: string
  home_club_code: string
  away_club_code: string
  kickoff_at: string
  home_score: number | null
  away_score: number | null
}

export type MatchdaySquadPlayer = {
  id: string
  club_code: string
}

export function rankRelevantFixtures(fixtures: MatchdayFixture[], squad: MatchdaySquadPlayer[]) {
  return fixtures.map((fixture) => {
    const involvedPlayerIds = squad
      .filter((player) => player.club_code === fixture.home_club_code || player.club_code === fixture.away_club_code)
      .map((player) => player.id)

    return { ...fixture, involvedPlayerIds, relevance: involvedPlayerIds.length }
  }).sort((left, right) => right.relevance - left.relevance
    || Date.parse(left.kickoff_at) - Date.parse(right.kickoff_at)
    || left.id.localeCompare(right.id))
}
