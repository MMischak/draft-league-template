'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react'
import { managerNameToEmail } from '@/lib/auth/manager-login'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [managerName, setManagerName] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const supabase = createClient()
    const email = await managerNameToEmail(managerName)

    if (mode === 'register') {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: managerName.trim(), invite_code: inviteCode.trim() } },
      })
      if (signUpError) {
        setError(signUpError.message.includes('Database error') ? 'Managername oder Liga-Code ist ungültig, oder die Liga ist bereits voll.' : 'Der Account konnte nicht erstellt werden. Prüfe Managername und Liga-Code.')
        setBusy(false)
        return
      }
      if (!data.session) {
        setError('Die Anmeldung ist derzeit nicht verfügbar. Bitte wende dich an den Commissioner.')
        setBusy(false)
        return
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError('Managername oder Passwort ist falsch.')
        setBusy(false)
        return
      }
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="grid min-h-screen bg-[#0f1e3a] lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.15)_1px,transparent_1px)] [background-size:38px_38px]" />
        <div className="relative flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-white text-[#0f1e3a]"><ShieldCheck className="size-5" /></span><div><p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[#ff6977]">Draft League</p><p className="font-serif text-xl font-black">Premier League 2026/27</p></div></div>
        <h1 className="relative max-w-xl font-serif text-6xl font-black leading-[.96]">Jeder Spieler gehört genau einem Manager.</h1>
        <span />
      </section>

      <section className="flex min-h-screen items-center justify-center bg-[#f6f0e2] px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <h2 className="font-serif text-4xl font-black">{mode === 'login' ? 'Anmelden' : 'Account erstellen'}</h2>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block text-xs font-bold">Managername<div className="relative mt-2"><UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#0f1e3a]/35" /><input required maxLength={40} autoComplete="username" value={managerName} onChange={(event) => setManagerName(event.target.value)} className="h-12 w-full rounded-xl border border-[#0f1e3a]/15 bg-white/65 pl-10 pr-3 text-sm outline-none" /></div></label>
            <label className="block text-xs font-bold">Passwort<div className="relative mt-2"><LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#0f1e3a]/35" /><input required minLength={8} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-[#0f1e3a]/15 bg-white/65 pl-10 pr-3 text-sm outline-none" /></div></label>
            {mode === 'register' && <label className="block text-xs font-bold">Liga-Code<input required value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#0f1e3a]/15 bg-white/65 px-3 font-mono text-sm outline-none" /></label>}
            {error && <p role="alert" className="rounded-xl bg-[#fff0f1] p-3 text-xs font-bold text-[#b32131]">{error}</p>}
            <button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#e93545] text-sm font-bold text-white disabled:opacity-45">{busy ? 'Bitte warten…' : mode === 'login' ? 'Anmelden' : 'Account erstellen'}<ArrowRight className="size-4" /></button>
          </form>
          <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }} className="mt-5 w-full text-center text-xs font-bold text-[#315dc6]">{mode === 'login' ? 'Noch kein Account? Jetzt beitreten' : 'Bereits registriert? Zur Anmeldung'}</button>
        </div>
      </section>
    </main>
  )
}
