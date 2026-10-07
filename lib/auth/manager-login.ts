const MANAGER_EMAIL_DOMAIN = 'manager.example.invalid'

export function normalizeManagerName(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()
}

export async function managerNameToEmail(value: string) {
  const managerName = normalizeManagerName(value)

  if (!managerName) {
    throw new Error('Manager name is required.')
  }

  const input = new TextEncoder().encode(`draft-league:${managerName}`)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', input)
  const identifier = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')

  return `manager-${identifier.slice(0, 48)}@${MANAGER_EMAIL_DOMAIN}`
}
