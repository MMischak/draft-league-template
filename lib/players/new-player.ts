export type PlayerPosition = 'GK' | 'DEF' | 'MID' | 'FWD'

export function newPlayerInput(name: string, position: PlayerPosition, clubCode: string) {
  return {
    display_name: name.trim().replace(/\s+/g, ' '),
    position,
    club_code: clubCode.trim().toUpperCase(),
  }
}
