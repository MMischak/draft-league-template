export default function AppLoading() {
  return <main aria-label="Seite wird geladen" className="mx-auto max-w-[1440px] animate-pulse px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
    <div className="mb-6 flex items-end justify-between gap-4"><div><div className="h-2.5 w-32 rounded bg-[#315dc6]/18" /><div className="mt-3 h-10 w-64 max-w-[70vw] rounded-lg bg-[#0f1e3a]/12" /></div><div className="hidden h-11 w-36 rounded-full bg-[#0f1e3a]/12 sm:block" /></div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,.6fr)]"><div className="ticket-cut h-56 bg-[#315dc6]/55" /><div className="surface h-56" /></div>
    <div className="mt-4 grid gap-4 lg:grid-cols-3"><div className="surface h-44 lg:col-span-2" /><div className="surface h-44" /></div>
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.35fr]"><div className="surface h-40" /><div className="surface h-40" /></div>
  </main>
}
