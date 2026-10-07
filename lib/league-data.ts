import 'server-only'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/supabase/database.types'

export type Manager = Tables<'managers'>
export type League = Tables<'leagues'>
export type Gameweek = Tables<'gameweeks'>
export type PlayerRow = Tables<'players'>
export type Fixture = Tables<'fixtures'>
export type Score = Tables<'manager_gameweek_scores'>

async function requireClaims() {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) redirect('/login')

  return { supabase, claims: claimsData.claims }
}

export async function requireManager() {
  const { supabase, claims } = await requireClaims()

  const { data: manager, error: managerError } = await supabase
    .from('managers')
    .select('*')
    .eq('id', claims.sub)
    .single()
  if (managerError || !manager) throw new Error('Manager profile could not be loaded.')

  return { supabase, claims, manager }
}

export async function requireViewer() {
  const { supabase, claims } = await requireClaims()

  const { data: viewer, error: viewerError } = await supabase
    .from('managers')
    .select('*,league:leagues(*)')
    .eq('id', claims.sub)
    .single()
  if (viewerError || !viewer?.league) throw new Error('Manager and league could not be loaded.')

  const { league, ...manager } = viewer

  return { supabase, claims, manager, league }
}

export async function getCurrentGameweek(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: current } = await supabase
    .from('gameweeks')
    .select('*')
    .neq('status', 'final')
    .order('number')
    .limit(1)
    .maybeSingle()
  if (current) return current

  const { data: latest } = await supabase
    .from('gameweeks')
    .select('*')
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle()
  return latest
}

export function leaderboard(
  managers: Pick<Manager, 'id' | 'display_name'>[],
  scores: Pick<Score, 'manager_id' | 'gameweek_id' | 'score'>[],
  currentGameweekId?: string,
) {
  const rows = managers.map((manager) => {
    const managerScores = scores.filter((score) => score.manager_id === manager.id)
    return {
      manager,
      week: managerScores.find((score) => score.gameweek_id === currentGameweekId)?.score ?? 0,
      total: managerScores.reduce((sum, score) => sum + Number(score.score), 0),
    }
  }).sort((a, b) => b.total - a.total || a.manager.display_name.localeCompare(b.manager.display_name))

  let lastTotal: number | null = null
  let lastRank = 0
  return rows.map((row, index) => {
    if (lastTotal === null || row.total !== lastTotal) lastRank = index + 1
    lastTotal = row.total
    return { ...row, rank: lastRank }
  })
}

export function formatKickoff(value: string) {
  return new Intl.DateTimeFormat('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' }).format(new Date(value))
}

export function formatDate(value: string | null) {
  if (!value) return 'Noch nicht festgelegt'
  return new Intl.DateTimeFormat('de-AT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' }).format(new Date(value))
}
