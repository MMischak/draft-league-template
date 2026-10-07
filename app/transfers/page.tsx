import { ArrowRightLeft, CalendarRange } from 'lucide-react'
import { ClubCrest } from '@/components/club-identity'
import { getClubName } from '@/lib/football/clubs'
import { formatDate, requireViewer } from '@/lib/league-data'

export default async function TransfersPage() {
  const { supabase, manager, league } = await requireViewer()
  const [{ data: trades }, { data: players }, { data: managers }] = await Promise.all([
    supabase.from('trades').select('*').order('created_at', { ascending: false }),
    supabase.from('players').select('id,display_name,club_code,position,owner_id').order('display_name'),
    supabase.from('managers').select('*'),
  ])
  const playerById = new Map((players ?? []).map((player) => [player.id, player]))
  const managerById = new Map((managers ?? []).map((entry) => [entry.id, entry]))
  const freePlayers = (players ?? []).filter((player) => !player.owner_id)
  const allowance = Math.max(0, 5 - manager.transfer_usage)
  const now = new Date()
  const open = Boolean(league.transfer_opens_at && league.transfer_closes_at && new Date(league.transfer_opens_at) <= now && new Date(league.transfer_closes_at) >= now)

  return <main className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><h1 className="font-serif text-3xl font-black sm:text-4xl">Transfers</h1><div className="rounded-2xl bg-[#0f1e3a] px-5 py-3 text-white"><p className="font-mono text-[9px] font-bold uppercase text-white/45">Verfügbar</p><p className="mt-1 font-serif text-2xl font-black">{allowance} von 5</p></div></div>
    <section className={`ticket-cut p-5 text-white sm:p-6 ${open ? 'bg-[#236845]' : 'bg-[#315dc6]'}`}><div className="flex flex-wrap items-center justify-between gap-5"><div><h2 className="font-serif text-2xl font-black">{open ? 'Transferfenster offen' : `Öffnet: ${formatDate(league.transfer_opens_at)}`}</h2><p className="mt-2 text-xs text-white/65">Schließt: {formatDate(league.transfer_closes_at)}</p></div><CalendarRange className="size-9 text-white/55" /></div></section>
    <div className="mt-4 grid gap-4 lg:grid-cols-2"><section className="surface p-5"><div className="flex items-center justify-between"><h2 className="font-serif text-xl font-black">Trades</h2><ArrowRightLeft className="size-5 text-[#315dc6]" /></div><div className="mt-4 divide-y divide-[#0f1e3a]/10">{trades?.length ? trades.map((trade) => { const offered = playerById.get(trade.offered_player_id); const requested = playerById.get(trade.requested_player_id); return <div key={trade.id} className="py-4"><div className="flex justify-between gap-3"><p className="text-sm font-bold">{managerById.get(trade.proposer_id)?.display_name} → {managerById.get(trade.recipient_id)?.display_name}</p><span className="font-mono text-[9px] uppercase text-[#0f1e3a]/45">{trade.status}</span></div><p className="mt-2 text-xs text-[#0f1e3a]/55">{offered?.display_name} gegen {requested?.display_name}</p></div> }) : <p className="py-5 text-sm text-[#0f1e3a]/45">Keine Trades.</p>}</div></section><section className="surface p-5"><div className="flex items-center justify-between"><h2 className="font-serif text-xl font-black">Freie Spieler</h2><span className="font-mono text-[10px] font-bold text-[#0f1e3a]/45">{freePlayers.length}</span></div><div className="mt-4 max-h-[420px] divide-y divide-[#0f1e3a]/10 overflow-y-auto">{freePlayers.slice(0, 80).map((player) => <div key={player.id} className="flex items-center gap-2.5 py-3"><ClubCrest code={player.club_code} size={26} /><div className="min-w-0"><p className="truncate text-sm font-bold">{player.display_name}</p><p className="truncate text-[9px] text-[#0f1e3a]/40">{getClubName(player.club_code)} · <span className="font-mono">{player.position}</span></p></div></div>)}</div>{!open && <p className="mt-4 rounded-xl bg-[#0f1e3a]/5 p-3 text-xs text-[#0f1e3a]/50">Transferfenster geschlossen.</p>}</section></div>
  </main>
}
