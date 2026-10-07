import Link from 'next/link'
import { ArrowLeft, Lightbulb } from 'lucide-react'
import { FeatureIdeas, type FeatureIdea } from '@/components/feature-ideas'
import { requireViewer } from '@/lib/league-data'

export default async function IdeasPage() {
  const { supabase, manager, league } = await requireViewer()
  const [{ data: suggestions }, { data: votes }, { data: comments }, { data: managers }] = await Promise.all([
    supabase.from('feature_suggestions').select('id,title,description,created_at,completed_at,author_id').order('created_at', { ascending: false }),
    supabase.from('feature_votes').select('suggestion_id,manager_id'),
    supabase.from('feature_comments').select('id,suggestion_id,body,created_at,manager_id').order('created_at'),
    supabase.from('managers').select('id, display_name'),
  ])

  const names = new Map((managers ?? []).map((entry) => [entry.id, entry.display_name]))
  const ideas: FeatureIdea[] = (suggestions ?? []).map((suggestion) => ({
    id: suggestion.id,
    title: suggestion.title,
    description: suggestion.description,
    createdAt: suggestion.created_at,
    completedAt: suggestion.completed_at,
    authorName: names.get(suggestion.author_id) ?? 'Manager',
    voterIds: (votes ?? []).filter((vote) => vote.suggestion_id === suggestion.id).map((vote) => vote.manager_id),
    comments: (comments ?? []).filter((comment) => comment.suggestion_id === suggestion.id).map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.created_at,
      managerId: comment.manager_id,
      authorName: names.get(comment.manager_id) ?? 'Manager',
    })),
  }))

  return <main className="mx-auto max-w-[960px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
    <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-[#0f1e3a]/55 hover:text-[#315dc6]"><ArrowLeft className="size-4" /> Zurück zu Home</Link>
    <header className="my-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow text-[#d79a2b]">{league.name}</p>
        <h1 className="mt-1 font-serif text-3xl font-black tracking-tight sm:text-4xl">Ideen für unsere Liga</h1>
      </div>
      <div className="grid size-14 place-items-center rounded-2xl bg-[#d79a2b] text-white shadow-[0_10px_26px_rgba(215,154,43,.25)]"><Lightbulb className="size-7" /></div>
    </header>
    <FeatureIdeas initialIdeas={ideas} leagueId={league.id} managerId={manager.id} managerName={manager.display_name} isCommissioner={manager.is_commissioner} />
  </main>
}
