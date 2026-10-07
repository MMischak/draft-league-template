import { getClubIdentity } from '@/lib/football/clubs'

export function ClubCrest({ code, size = 28, className = '' }: { code: string; size?: number; className?: string }) {
  const club = getClubIdentity(code)
  return <img src={club.crestPath} alt="" aria-hidden="true" width={size} height={size} loading="lazy" decoding="async" className={`shrink-0 object-contain ${className}`} />
}

export function ClubIdentity({ code, size = 28, className = '', nameClassName = '' }: {
  code: string
  size?: number
  className?: string
  nameClassName?: string
}) {
  const club = getClubIdentity(code)
  return <span title={club.name} className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
    <ClubCrest code={code} size={size} />
    <span className={`min-w-0 ${nameClassName}`}>{club.name}</span>
  </span>
}
