export type ClubTheme = {
  primary: string
  secondary: string
  foreground: string
}

const CLUB_THEMES: Record<string, ClubTheme> = {
  ARS: { primary: '#EF0107', secondary: '#FFFFFF', foreground: '#FFFFFF' },
  AVL: { primary: '#670E36', secondary: '#95BFE5', foreground: '#FFFFFF' },
  BOU: { primary: '#DA291C', secondary: '#111111', foreground: '#FFFFFF' },
  BRE: { primary: '#E30613', secondary: '#FFFFFF', foreground: '#FFFFFF' },
  BHA: { primary: '#0057B8', secondary: '#FFFFFF', foreground: '#FFFFFF' },
  BUR: { primary: '#6C1D45', secondary: '#99D6EA', foreground: '#FFFFFF' },
  CHE: { primary: '#034694', secondary: '#FFFFFF', foreground: '#FFFFFF' },
  COV: { primary: '#69B3E7', secondary: '#FFFFFF', foreground: '#10233F' },
  CRY: { primary: '#1B458F', secondary: '#C4122E', foreground: '#FFFFFF' },
  EVE: { primary: '#003399', secondary: '#FFFFFF', foreground: '#FFFFFF' },
  FUL: { primary: '#111111', secondary: '#CC0000', foreground: '#FFFFFF' },
  HUL: { primary: '#F5A623', secondary: '#111111', foreground: '#111111' },
  IPS: { primary: '#0044AA', secondary: '#FFFFFF', foreground: '#FFFFFF' },
  LEE: { primary: '#1D428A', secondary: '#FFCD00', foreground: '#FFFFFF' },
  LEI: { primary: '#003090', secondary: '#FDBE11', foreground: '#FFFFFF' },
  LIV: { primary: '#C8102E', secondary: '#00B2A9', foreground: '#FFFFFF' },
  MCI: { primary: '#6CABDD', secondary: '#1C2C5B', foreground: '#10233F' },
  MID: { primary: '#D71920', secondary: '#FFFFFF', foreground: '#FFFFFF' },
  MUN: { primary: '#DA291C', secondary: '#FBE122', foreground: '#FFFFFF' },
  NEW: { primary: '#241F20', secondary: '#FFFFFF', foreground: '#FFFFFF' },
  NFO: { primary: '#DD0000', secondary: '#FFFFFF', foreground: '#FFFFFF' },
  SHU: { primary: '#EE2737', secondary: '#111111', foreground: '#FFFFFF' },
  SOU: { primary: '#D71920', secondary: '#FFFFFF', foreground: '#FFFFFF' },
  SUN: { primary: '#EB172B', secondary: '#111111', foreground: '#FFFFFF' },
  TOT: { primary: '#132257', secondary: '#FFFFFF', foreground: '#FFFFFF' },
  WBA: { primary: '#122F67', secondary: '#FFFFFF', foreground: '#FFFFFF' },
  WHU: { primary: '#7A263A', secondary: '#1BB1E7', foreground: '#FFFFFF' },
  WOL: { primary: '#FDB913', secondary: '#231F20', foreground: '#231F20' },
}

const FALLBACK_THEMES: ClubTheme[] = [
  { primary: '#315DC6', secondary: '#E8B44A', foreground: '#FFFFFF' },
  { primary: '#236845', secondary: '#F4D35E', foreground: '#FFFFFF' },
  { primary: '#8E3B6D', secondary: '#F3B7C8', foreground: '#FFFFFF' },
  { primary: '#006D77', secondary: '#83C5BE', foreground: '#FFFFFF' },
]

export function getClubTheme(clubCode: string): ClubTheme {
  const normalizedCode = clubCode.trim().toUpperCase()
  const knownTheme = CLUB_THEMES[normalizedCode]
  if (knownTheme) return knownTheme

  const themeIndex = Array.from(normalizedCode).reduce((sum, character) => sum + character.charCodeAt(0), 0) % FALLBACK_THEMES.length
  return FALLBACK_THEMES[themeIndex]
}
