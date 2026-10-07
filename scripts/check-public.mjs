import { readdir, readFile, lstat } from 'node:fs/promises'
import { resolve, relative, basename } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ignored = new Set(['.git', 'node_modules', '.next', '.local', '.vercel', 'coverage', 'exports'])
const forbidden = /(^|\/)(\.env(?:\..+)?|\.npmrc|\.netrc|\.mcp\.json|\.DS_Store|.*\.(?:pem|key|p12|pfx|log|sql\.gz)|id_rsa|id_ed25519)$/i
const patterns = [
  ['API token', /\b(?:sb_(?:secret|publishable)_[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['embedded credentials', /(?:postgres(?:ql)?|https?):\/\/[^\s/@:]+:[^\s/@]+@/i],
  ['personal deployment', /https:\/\/(?!your-project\.supabase\.co)[a-z0-9-]+\.supabase\.co\b|https:\/\/[a-z0-9-]+\.vercel\.app\b/i],
  ['local user path', /\/(?:Users|home)\/[A-Za-z0-9._-]+\//],
]

export async function listFiles(root) {
  const files = []
  async function visit(dir) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      if (ignored.has(item.name)) continue
      const path = resolve(dir, item.name)
      if (item.isDirectory()) await visit(path)
      else files.push(relative(root, path).replaceAll('\\', '/'))
    }
  }
  await visit(root)
  return files.sort()
}

export async function inspectFiles(root, files, protectedValues = []) {
  const findings = []
  for (const file of files) {
    const path = resolve(root, file)
    if (!path.startsWith(`${resolve(root)}/`)) throw new Error('File outside scan root.')
    const stat = await lstat(path)
    if (stat.isSymbolicLink()) { findings.push({ file, reason: 'symlink' }); continue }
    if (forbidden.test(file) && basename(file) !== '.env.example') findings.push({ file, reason: 'private file' })
    const bytes = await readFile(path)
    const content = bytes.toString('utf8')
    // Search bytes for known local values even in binary files.
    if (protectedValues.some(value => value.length >= 8 && bytes.includes(Buffer.from(value)))) findings.push({ file, reason: 'known private value' })
    if (bytes.includes(0)) continue
    for (const [reason, pattern] of patterns) {
      if (pattern.test(content)) findings.push({ file, reason })
    }
    if (basename(file) === '.env.example') {
      for (const line of content.split(/\r?\n/)) {
        if (!line.trim() || line.trimStart().startsWith('#')) continue
        if (!/^[A-Z_][A-Z0-9_]*=$/.test(line) && line !== 'NEXT_PUBLIC_APP_URL=http://localhost:3000') findings.push({ file, reason: 'filled environment example' })
      }
    }
  }
  return findings
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd()
  let files
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    if (resolve(top) === resolve(root)) files = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean)
  } catch {}
  files ??= await listFiles(root)
  const findings = await inspectFiles(root, files)
  for (const { file, reason } of findings) console.error(`${file}: ${reason}`)
  if (findings.length) process.exitCode = 1
  else console.log(`Public-file check passed (${files.length} files). Pattern scan; no guarantee for arbitrary secrets or image pixels.`)
}
