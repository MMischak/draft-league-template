'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChartSpline } from 'lucide-react'
import {
  buildLeaderboardHistory,
  type HistoryGameweek,
  type HistoryManager,
  type HistoryScore,
} from '@/lib/leaderboard-history'

const MANAGER_COLORS = ['#315dc6', '#e93545', '#236845', '#d79a2b', '#7a4db3']
const CHART_TOP = 34
const CHART_BOTTOM = 44
const CHART_LEFT = 54
const CHART_RIGHT = 24
const CHART_HEIGHT = 300

type HistoryMetric = 'rank' | 'points'

export function LeaderboardHistory({ managers, gameweeks, scores }: {
  managers: HistoryManager[]
  gameweeks: HistoryGameweek[]
  scores: HistoryScore[]
}) {
  const histories = useMemo(() => buildLeaderboardHistory(managers, gameweeks, scores), [gameweeks, managers, scores])
  const weekCount = histories[0]?.points.length ?? 0
  const [metric, setMetric] = useState<HistoryMetric>('rank')
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(Math.max(0, weekCount - 1))
  const [chartViewportWidth, setChartViewportWidth] = useState(0)
  const chartScroller = useRef<HTMLDivElement>(null)
  const safeSelectedWeekIndex = Math.min(selectedWeekIndex, Math.max(0, weekCount - 1))
  const chartContentWidth = CHART_LEFT + CHART_RIGHT + Math.max(260, (weekCount - 1) * 64)
  const chartWidth = Math.max(chartContentWidth, chartViewportWidth)
  const plotWidth = chartWidth - CHART_LEFT - CHART_RIGHT
  const plotHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM
  const highestTotal = Math.max(0, ...histories.flatMap((history) => history.points.map((point) => point.total)))
  const pointsCeiling = Math.max(10, Math.ceil(highestTotal / 10) * 10)
  const pointsTicks = Array.from({ length: 5 }, (_, index) => Math.round(pointsCeiling * (1 - index / 4)))
  const rankTicks = Array.from({ length: managers.length }, (_, index) => index + 1)
  const xForWeek = (index: number) => CHART_LEFT + (weekCount <= 1 ? plotWidth / 2 : (index / (weekCount - 1)) * plotWidth)
  const yForRank = (rank: number) => CHART_TOP + (managers.length <= 1 ? plotHeight / 2 : ((rank - 1) / (managers.length - 1)) * plotHeight)
  const yForTotal = (total: number) => CHART_TOP + (1 - total / pointsCeiling) * plotHeight
  const yForPoint = (rank: number, total: number) => metric === 'rank' ? yForRank(rank) : yForTotal(total)
  const selectedPoint = histories[0]?.points[safeSelectedWeekIndex]
  const selectedStandings = histories
    .map((history, managerIndex) => ({ history, managerIndex, point: history.points[safeSelectedWeekIndex] }))
    .filter((entry) => entry.point)
    .sort((left, right) => left.point.rank - right.point.rank || right.point.total - left.point.total)

  useEffect(() => {
    const scroller = chartScroller.current
    if (!scroller) return
    const syncWidth = () => setChartViewportWidth(Math.round(scroller.clientWidth))
    syncWidth()
    const observer = new ResizeObserver(syncWidth)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (chartScroller.current) chartScroller.current.scrollLeft = chartScroller.current.scrollWidth
    })
    return () => cancelAnimationFrame(frame)
  }, [chartWidth, weekCount])

  return <section className="surface overflow-hidden">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0f1e3a]/10 px-3 py-4 sm:px-5">
      <div><p className="eyebrow text-[#315dc6]">Gameweek für Gameweek</p><h2 className="mt-1 font-serif text-xl font-black">Liga-Verlauf</h2></div>
      <div className="grid w-full grid-cols-2 rounded-xl bg-[#0f1e3a]/6 p-1 sm:w-auto" role="group" aria-label="Darstellung des Ligaverlaufs">
        <button type="button" aria-pressed={metric === 'rank'} onClick={() => setMetric('rank')} className={`rounded-lg px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-wide transition ${metric === 'rank' ? 'bg-[#0f1e3a] text-white shadow-sm' : 'text-[#0f1e3a]/50 hover:text-[#0f1e3a]'}`}>Position</button>
        <button type="button" aria-pressed={metric === 'points'} onClick={() => setMetric('points')} className={`rounded-lg px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-wide transition ${metric === 'points' ? 'bg-[#0f1e3a] text-white shadow-sm' : 'text-[#0f1e3a]/50 hover:text-[#0f1e3a]'}`}>Punkte</button>
      </div>
    </header>

    {weekCount ? <>
      <div className="px-3 pt-4 sm:px-5">
        <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:flex sm:flex-wrap sm:gap-x-4">{histories.map((history, managerIndex) => <span key={history.managerId} className={`inline-flex min-w-0 items-center gap-1.5 text-[10px] font-bold ${history.isViewer ? 'text-[#0f1e3a]' : 'text-[#0f1e3a]/55'}`}><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: MANAGER_COLORS[managerIndex % MANAGER_COLORS.length] }} /><span className="truncate">{history.displayName}{history.isViewer ? ' · Du' : ''}</span></span>)}</div>
        <div ref={chartScroller} className="overscroll-x-contain overflow-x-auto rounded-[1.15rem] border border-[#0f1e3a]/10 bg-[#fffdf7] shadow-inner" style={{ scrollbarGutter: 'stable' }}>
          <svg width={chartWidth} height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`} role="img" aria-label={metric === 'rank' ? 'Tabellenpositionen aller Manager nach Gameweek' : 'Kumulierte Punkte aller Manager nach Gameweek'} className="block max-w-none">
            <rect width={chartWidth} height={CHART_HEIGHT} fill="#fffdf7" />
            {(metric === 'rank' ? rankTicks : pointsTicks).map((tick, index, ticks) => {
              const y = metric === 'rank' ? yForRank(tick) : CHART_TOP + (index / Math.max(1, ticks.length - 1)) * plotHeight
              return <g key={tick}><line x1={CHART_LEFT} x2={chartWidth - CHART_RIGHT} y1={y} y2={y} stroke="#0f1e3a" strokeOpacity="0.1" strokeDasharray="4 7" /><text x={CHART_LEFT - 17} y={y + 4} fill="#0f1e3a" fillOpacity="0.45" fontFamily="monospace" fontSize="9" fontWeight="700" textAnchor="middle">{metric === 'rank' ? tick : tick.toFixed(0)}</text></g>
            })}
            <text x={13} y={17} fill="#0f1e3a" fillOpacity="0.35" fontFamily="monospace" fontSize="8" fontWeight="700">{metric === 'rank' ? 'PLATZ' : 'PKT'}</text>
            {selectedPoint && <rect x={xForWeek(safeSelectedWeekIndex) - 24} y={CHART_TOP - 13} width="48" height={plotHeight + 34} rx="12" fill="#315dc6" fillOpacity="0.065" />}
            {histories.map((history, managerIndex) => {
              const color = MANAGER_COLORS[managerIndex % MANAGER_COLORS.length]
              const path = history.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xForWeek(index)} ${yForPoint(point.rank, point.total)}`).join(' ')
              return <g key={history.managerId}>
                <path d={path} fill="none" stroke="#fffdf7" strokeWidth="7" strokeLinejoin="round" />
                <path d={path} fill="none" stroke={color} strokeWidth={history.isViewer ? 4 : 3} strokeLinecap="round" strokeLinejoin="round" />
                {history.points.map((point, index) => <circle key={point.gameweekId} cx={xForWeek(index)} cy={yForPoint(point.rank, point.total)} r={index === safeSelectedWeekIndex ? 6 : 4} fill={color} stroke="#fffdf7" strokeWidth="2.5"><title>{`${history.displayName}: ${point.total.toFixed(1)} Punkte · Platz ${point.rank}`}</title></circle>)}
              </g>
            })}
            {histories[0].points.map((point, index) => {
              const x = xForWeek(index)
              const halfStep = weekCount <= 1 ? 34 : plotWidth / (weekCount - 1) / 2
              return <g key={point.gameweekId} role="button" tabIndex={0} aria-label={`Gameweek ${point.gameweekNumber} anzeigen`} onClick={() => setSelectedWeekIndex(index)} onFocus={() => setSelectedWeekIndex(index)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedWeekIndex(index) } }} className="cursor-pointer outline-none">
                <rect x={x - halfStep} y={CHART_TOP - 16} width={halfStep * 2} height={plotHeight + 42} fill="transparent" />
                <text x={x} y={CHART_HEIGHT - 14} fill="#0f1e3a" fillOpacity={index === safeSelectedWeekIndex ? '0.9' : '0.4'} fontFamily="monospace" fontSize="9" fontWeight="700" textAnchor="middle">GW {point.gameweekNumber}</text>
              </g>
            })}
          </svg>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-[#0f1e3a]/40">{metric === 'rank' ? 'Position zeigt die Platzierung nach jeder Gameweek.' : 'Punkte zeigt die kumulierten Gesamtpunkte – die Linienabstände entsprechen dem tatsächlichen Punktabstand.'}</p>
      </div>

      <div className="m-3 rounded-[1.15rem] bg-[#0f1e3a] p-3 text-white sm:m-5 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-serif text-lg font-black">Gameweek {selectedPoint?.gameweekNumber}</h3><p className="font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-white/45">GW-Punkte · Gesamt</p></div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {selectedStandings.map(({ history, managerIndex, point }) => {
            const previousRank = history.points[safeSelectedWeekIndex - 1]?.rank ?? point.rank
            const movement = previousRank - point.rank
            return <article key={history.managerId} className={`grid grid-cols-[26px_9px_1fr_auto] items-center gap-2 rounded-xl px-2.5 py-2 ${history.isViewer ? 'bg-white/12' : 'bg-white/[0.055]'}`}>
              <span className="font-serif text-lg font-black">{point.rank}</span>
              <span className="size-2.5 rounded-full" style={{ backgroundColor: MANAGER_COLORS[managerIndex % MANAGER_COLORS.length] }} />
              <div className="min-w-0"><p className="truncate text-xs font-bold">{history.displayName}{history.isViewer ? ' · Du' : ''}</p><p className="mt-0.5 flex items-center gap-1 font-mono text-[8px] text-white/45">{movement > 0 ? <ArrowUp className="size-2.5 text-[#7ee2a8]" /> : movement < 0 ? <ArrowDown className="size-2.5 text-[#ff8a94]" /> : <span className="inline-block w-2.5">—</span>}{movement ? `${Math.abs(movement)} Platz${Math.abs(movement) === 1 ? '' : 'e'}` : 'unverändert'}</p></div>
              <p className="whitespace-nowrap font-mono text-[9px]"><strong className="text-sm text-[#ffd166]">+{point.score.toFixed(1)}</strong><span className="mx-1 text-white/25">·</span>{point.total.toFixed(1)}</p>
            </article>
          })}
        </div>
      </div>
    </> : <div className="grid min-h-56 place-items-center px-6 text-center"><div><ChartSpline className="mx-auto size-8 text-[#0f1e3a]/25" /><p className="mt-3 text-sm font-bold">Der Ligaverlauf erscheint nach der ersten gewerteten Gameweek.</p></div></div>}
  </section>
}
