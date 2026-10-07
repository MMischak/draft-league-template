type SelectableGameweek = { number: number; status: string }

export function selectGameweek<T extends SelectableGameweek>(gameweeks: T[], requested: string | undefined) {
  const requestedNumber = Number(requested)
  const requestedGameweek = Number.isInteger(requestedNumber)
    ? gameweeks.find((gameweek) => gameweek.number === requestedNumber)
    : null

  return requestedGameweek
    ?? gameweeks.find((gameweek) => gameweek.status !== 'final')
    ?? gameweeks.at(-1)
    ?? null
}
