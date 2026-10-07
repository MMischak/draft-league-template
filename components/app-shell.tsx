'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CalendarDays, LayoutDashboard, LoaderCircle, LogOut, Repeat2, ShieldCheck, SlidersHorizontal, Trophy, UsersRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const primaryNav = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/draft', label: 'Draft', icon: UsersRound },
  { href: '/week', label: 'Matchday', icon: CalendarDays },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/transfers', label: 'Transfers', icon: Repeat2 },
]

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="Draft League home">
      <span className="grid size-10 place-items-center rounded-full bg-[#0f1e3a] text-[#f6f0e2] shadow-sm">
        <ShieldCheck className="size-5" />
      </span>
      <span>
        <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[#e93545]">Draft League</span>
        <span className="block font-serif text-lg font-black leading-none">Premier League 26/27</span>
      </span>
    </Link>
  )
}

function NavPendingIndicator({ className = '' }: { className?: string }) {
  const { pending } = useLinkStatus()
  return pending ? <LoaderCircle aria-hidden="true" className={`size-3 animate-spin ${className}`} /> : null
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const inApp = pathname !== '/login'
  const [manager, setManager] = useState('Manager')
  const [isCommissioner, setIsCommissioner] = useState(false)

  useEffect(() => {
    if (!inApp) { setManager('Manager'); setIsCommissioner(false); return }
    const supabase = createClient()
    supabase.auth.getClaims().then(async ({ data }) => {
      if (!data?.claims) { router.replace('/login'); return }
      const { data: profile } = await supabase.from('managers').select('display_name').eq('id', data.claims.sub).single()
      setManager(profile?.display_name ?? 'Manager')
      setIsCommissioner(data.claims.app_metadata?.role === 'commissioner')
    })
  }, [inApp, router])

  if (pathname === '/login') return children

  const signOut = async () => {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <header className="sticky top-0 z-40 border-b border-[#0f1e3a]/12 bg-[#f6f0e2]/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Brand />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {primaryNav.map((item) => {
              const active = pathname === item.href || (item.href === '/leaderboard' && pathname === '/stats')
              return (
                <Link key={item.href} href={item.href} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition ${active ? 'bg-[#0f1e3a] text-white' : 'text-[#0f1e3a]/60 hover:bg-[#0f1e3a]/6 hover:text-[#0f1e3a]'}`}>
                  {item.label}<NavPendingIndicator />
                </Link>
              )
            })}
          </nav>
          <div className="flex items-center gap-2">
            {isCommissioner && <Link href="/commissioner" aria-label="Commissioner settings" className={`rounded-full border p-2.5 ${pathname === '/commissioner' ? 'border-[#315dc6] bg-[#315dc6] text-white' : 'border-[#0f1e3a]/12 bg-white/55 text-[#0f1e3a]/65'}`}><SlidersHorizontal className="size-4" /></Link>}
            <button onClick={signOut} aria-label="Sign out" className="hidden rounded-full border border-[#0f1e3a]/12 bg-white/55 p-2.5 text-[#0f1e3a]/65 sm:block">
              <LogOut className="size-4" />
            </button>
            <span title={manager} className="grid size-9 place-items-center rounded-full bg-[#315dc6] font-mono text-[10px] font-black text-white">{manager.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>
          </div>
        </div>
      </header>

      {children}

      <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 rounded-2xl border border-white/10 bg-[#0f1e3a]/96 p-1.5 text-white shadow-2xl backdrop-blur lg:hidden" aria-label="Mobile navigation">
        {primaryNav.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href === '/leaderboard' && pathname === '/stats')
          return (
            <Link key={item.href} href={item.href} className={`relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-bold ${active ? 'bg-white text-[#0f1e3a]' : 'text-white/60'}`}>
              <Icon className="size-4" />
              {item.label}
              <NavPendingIndicator className="absolute right-1.5 top-1.5" />
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
