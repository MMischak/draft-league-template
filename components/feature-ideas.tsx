'use client'

import { FormEvent, useState } from 'react'
import { Check, CheckCircle2, ChevronUp, LoaderCircle, MessageCircle, Plus, RotateCcw, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type IdeaComment = {
  id: string
  body: string
  createdAt: string
  managerId: string
  authorName: string
}

export type FeatureIdea = {
  id: string
  title: string
  description: string
  createdAt: string
  completedAt: string | null
  authorName: string
  voterIds: string[]
  comments: IdeaComment[]
}

type FeatureIdeasProps = {
  initialIdeas: FeatureIdea[]
  leagueId: string
  managerId: string
  managerName: string
  isCommissioner: boolean
}

const dateFormatter = new Intl.DateTimeFormat('de-AT', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Vienna',
})

export function FeatureIdeas({ initialIdeas, leagueId, managerId, managerName, isCommissioner }: FeatureIdeasProps) {
  const [ideas, setIdeas] = useState(initialIdeas)
  const [formOpen, setFormOpen] = useState(initialIdeas.every((idea) => idea.completedAt !== null))
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [pendingAction, setPendingAction] = useState('')
  const [error, setError] = useState('')

  const createIdea = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanTitle = title.trim()
    const cleanDescription = description.trim()
    if (cleanTitle.length < 3) {
      setError('Der Titel braucht mindestens 3 Zeichen.')
      return
    }

    setError('')
    setPendingAction('create')
    const { data, error: insertError } = await createClient()
      .from('feature_suggestions')
      .insert({ league_id: leagueId, author_id: managerId, title: cleanTitle, description: cleanDescription })
      .select('id, title, description, created_at')
      .single()

    setPendingAction('')
    if (insertError || !data) {
      setError('Der Vorschlag konnte nicht gespeichert werden.')
      return
    }

    setIdeas((current) => [{
      id: data.id,
      title: data.title,
      description: data.description,
      createdAt: data.created_at,
      completedAt: null,
      authorName: managerName,
      voterIds: [],
      comments: [],
    }, ...current])
    setTitle('')
    setDescription('')
    setFormOpen(false)
  }

  const toggleVote = async (ideaId: string) => {
    if (pendingAction) return
    const idea = ideas.find((entry) => entry.id === ideaId)
    if (!idea) return

    const hasVoted = idea.voterIds.includes(managerId)
    setError('')
    setPendingAction(`vote-${ideaId}`)
    setIdeas((current) => current.map((entry) => entry.id === ideaId ? {
      ...entry,
      voterIds: hasVoted ? entry.voterIds.filter((id) => id !== managerId) : [...entry.voterIds, managerId],
    } : entry))

    const supabase = createClient()
    const result = hasVoted
      ? await supabase.from('feature_votes').delete().eq('suggestion_id', ideaId).eq('manager_id', managerId)
      : await supabase.from('feature_votes').insert({ suggestion_id: ideaId, league_id: leagueId, manager_id: managerId })

    setPendingAction('')
    if (result.error) {
      setIdeas((current) => current.map((entry) => entry.id === ideaId ? {
        ...entry,
        voterIds: hasVoted ? [...entry.voterIds, managerId] : entry.voterIds.filter((id) => id !== managerId),
      } : entry))
      setError('Die Stimme konnte nicht gespeichert werden.')
    }
  }

  const addComment = async (event: FormEvent<HTMLFormElement>, ideaId: string) => {
    event.preventDefault()
    const body = (commentDrafts[ideaId] ?? '').trim()
    if (!body || pendingAction) return

    setError('')
    setPendingAction(`comment-${ideaId}`)
    const { data, error: insertError } = await createClient()
      .from('feature_comments')
      .insert({ suggestion_id: ideaId, league_id: leagueId, manager_id: managerId, body })
      .select('id, body, created_at')
      .single()

    setPendingAction('')
    if (insertError || !data) {
      setError('Der Kommentar konnte nicht gespeichert werden.')
      return
    }

    setIdeas((current) => current.map((idea) => idea.id === ideaId ? {
      ...idea,
      comments: [...idea.comments, {
        id: data.id,
        body: data.body,
        createdAt: data.created_at,
        managerId,
        authorName: managerName,
      }],
    } : idea))
    setCommentDrafts((current) => ({ ...current, [ideaId]: '' }))
  }

  const setIdeaCompleted = async (ideaId: string, completed: boolean) => {
    if (!isCommissioner || pendingAction) return
    const idea = ideas.find((entry) => entry.id === ideaId)
    if (!idea) return

    const previousCompletedAt = idea.completedAt
    const completedAt = completed ? new Date().toISOString() : null
    setError('')
    setPendingAction(`complete-${ideaId}`)
    setIdeas((current) => current.map((entry) => entry.id === ideaId ? { ...entry, completedAt } : entry))

    const { data, error: updateError } = await createClient()
      .from('feature_suggestions')
      .update({ completed_at: completedAt })
      .eq('league_id', leagueId)
      .eq('id', ideaId)
      .select('completed_at')
      .single()

    setPendingAction('')
    if (updateError || !data) {
      setIdeas((current) => current.map((entry) => entry.id === ideaId ? { ...entry, completedAt: previousCompletedAt } : entry))
      setError('Der Status konnte nicht gespeichert werden.')
      return
    }

    setIdeas((current) => current.map((entry) => entry.id === ideaId ? { ...entry, completedAt: data.completed_at } : entry))
  }

  const openIdeas = ideas.filter((idea) => idea.completedAt === null)
  const completedIdeas = ideas.filter((idea) => idea.completedAt !== null)

  return <div className="space-y-4">
    <div className="flex justify-end">
      <button type="button" onClick={() => setFormOpen((open) => !open)} className="inline-flex items-center gap-2 rounded-full bg-[#0f1e3a] px-4 py-2.5 text-xs font-bold text-white">
        <Plus className="size-4" /> Vorschlag machen
      </button>
    </div>

    {formOpen && <form onSubmit={createIdea} className="surface border-l-4 border-l-[#d79a2b] p-5 sm:p-6">
      <h2 className="font-serif text-xl font-black">Neue Idee</h2>
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="eyebrow">Titel</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required minLength={3} placeholder="Was sollen wir verbessern?" className="mt-2 w-full rounded-xl border border-[#0f1e3a]/15 bg-white/70 px-4 py-3 text-sm font-bold placeholder:font-normal placeholder:text-[#0f1e3a]/35" />
        </label>
        <label className="block">
          <span className="eyebrow">Beschreibung · optional</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={3} placeholder="Kurz erklären, wie es funktionieren soll." className="mt-2 w-full resize-y rounded-xl border border-[#0f1e3a]/15 bg-white/70 px-4 py-3 text-sm leading-6 placeholder:text-[#0f1e3a]/35" />
        </label>
      </div>
      <div className="mt-4 flex justify-end">
        <button disabled={pendingAction === 'create'} className="inline-flex items-center gap-2 rounded-xl bg-[#315dc6] px-4 py-3 text-sm font-bold text-white disabled:opacity-45">
          {pendingAction === 'create' && <LoaderCircle className="size-4 animate-spin" />} Idee veröffentlichen
        </button>
      </div>
    </form>}

    {error && <p role="alert" className="rounded-xl bg-[#fff0f1] px-4 py-3 text-sm font-bold text-[#b32131]">{error}</p>}

    {openIdeas.length === 0 ? <section className="surface px-5 py-10 text-center">
      <CheckCircle2 className="mx-auto size-8 text-[#45a264]" />
      <p className="mt-3 font-serif text-2xl font-black">Keine offenen Vorschläge</p>
      <p className="mt-2 text-sm text-[#0f1e3a]/50">Im Moment ist alles erledigt.</p>
    </section> : openIdeas.map((idea) => {
      const hasVoted = idea.voterIds.includes(managerId)
      return <article key={idea.id} className="surface overflow-hidden">
        <div className="grid sm:grid-cols-[88px_1fr]">
          <button type="button" onClick={() => toggleVote(idea.id)} disabled={pendingAction !== '' && pendingAction !== `vote-${idea.id}`} aria-pressed={hasVoted} aria-label={`${hasVoted ? 'Stimme entfernen' : 'Für Vorschlag stimmen'}: ${idea.title}`} className={`flex min-h-20 items-center justify-center gap-2 border-b px-4 py-4 sm:flex-col sm:border-b-0 sm:border-r ${hasVoted ? 'border-[#315dc6]/20 bg-[#315dc6] text-white' : 'border-[#0f1e3a]/10 bg-[#0f1e3a]/[.035] text-[#315dc6] hover:bg-[#315dc6]/8'}`}>
            {pendingAction === `vote-${idea.id}` ? <LoaderCircle className="size-5 animate-spin" /> : <ChevronUp className="size-6" />}
            <span className="font-serif text-2xl font-black leading-none">{idea.voterIds.length}</span>
            <span className={`font-mono text-[8px] font-bold uppercase tracking-wider ${hasVoted ? 'text-white/65' : 'text-[#0f1e3a]/40'}`}>{idea.voterIds.length === 1 ? 'Stimme' : 'Stimmen'}</span>
          </button>

          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="font-serif text-2xl font-black leading-tight">{idea.title}</h2>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] text-[#0f1e3a]/40">{dateFormatter.format(new Date(idea.createdAt))}</span>
                {isCommissioner && <button type="button" disabled={pendingAction !== ''} onClick={() => setIdeaCompleted(idea.id, true)} className="inline-flex items-center gap-1.5 rounded-full border border-[#45a264]/25 bg-[#45a264]/10 px-2.5 py-1.5 text-[10px] font-bold text-[#236845] hover:bg-[#45a264]/18 disabled:opacity-40">
                  {pendingAction === `complete-${idea.id}` ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Erledigt
                </button>}
              </div>
            </div>
            {idea.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#0f1e3a]/65">{idea.description}</p>}
            <p className="mt-3 text-xs font-bold text-[#0f1e3a]/45">von {idea.authorName}</p>

            <div className="mt-5 border-t border-[#0f1e3a]/10 pt-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0f1e3a]/50"><MessageCircle className="size-4" /> {idea.comments.length} {idea.comments.length === 1 ? 'Kommentar' : 'Kommentare'}</div>
              {idea.comments.length > 0 && <div className="mt-3 space-y-2">
                {idea.comments.map((comment) => <div key={comment.id} className="rounded-xl bg-[#0f1e3a]/[.045] px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold">{comment.authorName}</span><span className="font-mono text-[8px] text-[#0f1e3a]/35">{dateFormatter.format(new Date(comment.createdAt))}</span></div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-[#0f1e3a]/65">{comment.body}</p>
                </div>)}
              </div>}
              <form onSubmit={(event) => addComment(event, idea.id)} className="mt-3 flex gap-2">
                <label className="sr-only" htmlFor={`comment-${idea.id}`}>Kommentar zu {idea.title}</label>
                <input id={`comment-${idea.id}`} value={commentDrafts[idea.id] ?? ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [idea.id]: event.target.value }))} maxLength={600} required placeholder="Kommentar schreiben …" className="min-w-0 flex-1 rounded-xl border border-[#0f1e3a]/12 bg-white/65 px-3.5 py-2.5 text-sm placeholder:text-[#0f1e3a]/35" />
                <button disabled={pendingAction !== '' || !(commentDrafts[idea.id] ?? '').trim()} aria-label="Kommentar senden" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#0f1e3a] text-white disabled:opacity-30">
                  {pendingAction === `comment-${idea.id}` ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                </button>
              </form>
            </div>
          </div>
        </div>
      </article>
    })}

    {completedIdeas.length > 0 && <section className="pt-4">
      <div className="mb-2 flex items-center gap-2 px-1 text-[#0f1e3a]/45"><CheckCircle2 className="size-4 text-[#45a264]" /><h2 className="text-xs font-bold">Erledigte Vorschläge</h2><span className="font-mono text-[9px]">{completedIdeas.length}</span></div>
      <div className="overflow-hidden rounded-2xl border border-[#0f1e3a]/10 bg-[#fffdf7]/55">
        {completedIdeas.map((idea) => <article key={idea.id} className="grid grid-cols-[28px_1fr_auto] items-center gap-2.5 border-b border-[#0f1e3a]/7 px-3.5 py-3 text-[#0f1e3a]/48 last:border-b-0 sm:px-4">
          <span className="grid size-7 place-items-center rounded-full bg-[#45a264]/12 text-[#45a264]"><Check className="size-4" strokeWidth={3} /></span>
          <div className="min-w-0"><h3 className="truncate text-sm font-bold line-through decoration-[#45a264]/55">{idea.title}</h3><p className="mt-0.5 truncate text-[10px]">von {idea.authorName}{idea.completedAt ? ` · erledigt ${dateFormatter.format(new Date(idea.completedAt))}` : ''}</p></div>
          {isCommissioner && <button type="button" disabled={pendingAction !== ''} onClick={() => setIdeaCompleted(idea.id, false)} aria-label={`${idea.title} wieder öffnen`} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-bold text-[#0f1e3a]/45 hover:bg-white/70 hover:text-[#315dc6] disabled:opacity-35"><RotateCcw className={`size-3.5 ${pendingAction === `complete-${idea.id}` ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">Wieder öffnen</span></button>}
        </article>)}
      </div>
    </section>}
  </div>
}
