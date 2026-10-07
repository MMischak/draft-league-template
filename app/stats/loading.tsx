export default function StatisticsLoading() {
  return <main aria-label="Statistik-Center wird geladen" className="mx-auto max-w-[1180px] animate-pulse px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
    <div className="h-4 w-36 rounded bg-[#0f1e3a]/10" />
    <div className="ticket-cut mt-5 h-44 bg-[#0f1e3a]/88" />
    <div className="mt-4 grid gap-3 md:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="surface h-20" />)}</div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2"><div className="surface h-64" /><div className="surface h-64" /></div>
    <div className="surface mt-4 h-96" />
  </main>
}
