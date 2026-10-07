import Link from 'next/link'
import { ArrowLeft, Flag } from 'lucide-react'

export default function NotFound() {
  return <main className="mx-auto grid min-h-[calc(100vh-68px)] max-w-xl place-items-center px-4 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-full bg-[#e93545] text-white"><Flag className="size-6" /></span><h1 className="mt-6 font-serif text-4xl font-black">Seite nicht gefunden</h1><Link href="/" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#0f1e3a] px-5 py-3 text-sm font-bold text-white"><ArrowLeft className="size-4" />Zur Startseite</Link></div></main>
}
