export function pickNumberForManagerColumn(round: number, managerColumn: number, managerCount = 5) {
  if (!Number.isInteger(round) || round < 1) throw new RangeError('Round must be a positive integer.')
  if (!Number.isInteger(managerColumn) || managerColumn < 0 || managerColumn >= managerCount) {
    throw new RangeError('Manager column is outside the draft order.')
  }

  const slot = round % 2 === 1 ? managerColumn : managerCount - 1 - managerColumn
  return (round - 1) * managerCount + slot + 1
}

export function moveDraftManager<T>(managers: readonly T[], from: number, to: number) {
  if (from < 0 || from >= managers.length || to < 0 || to >= managers.length || from === to) {
    return [...managers]
  }

  const reordered = [...managers]
  const [manager] = reordered.splice(from, 1)
  reordered.splice(to, 0, manager)
  return reordered
}
