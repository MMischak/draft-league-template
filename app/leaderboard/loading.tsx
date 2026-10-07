export default function LeaderboardLoading() {
  return <main aria-label="Leaderboard wird geladen" className="mx-auto max-w-[1080px] animate-pulse px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
    <div className="mb-6"><div className="h-2.5 w-24 rounded bg-[#315dc6]/20" /><div className="mt-3 h-10 w-52 rounded-lg bg-[#0f1e3a]/12" /></div>
    <div className="ticket-cut h-40 bg-[#0f1e3a]/85" />
    <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_.75fr]"><div className="space-y-4"><section className="surface overflow-hidden"><div className="h-11 border-b border-[#0f1e3a]/10 bg-[#0f1e3a]/4" /><div className="divide-y divide-[#0f1e3a]/8">{Array.from({ length: 5 }, (_, index) => <div key={index} className="flex h-16 items-center gap-4 px-5"><div className="size-7 rounded bg-[#0f1e3a]/10" /><div className="h-3 flex-1 rounded bg-[#0f1e3a]/10" /><div className="h-3 w-14 rounded bg-[#315dc6]/12" /></div>)}</div></section><div className="ticket-cut h-28 bg-[#315dc6]/18" /></div><aside className="space-y-4"><div className="surface h-52" /><div className="h-28 rounded-2xl bg-[#e93545]/12" /></aside></div>
  </main>
}
