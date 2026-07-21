#!/usr/bin/env node
// Redacts personal data from all snapshot JSON files:
//   - created_by_email (email address)
//   - created_by (numeric user ID, GDPR-linkable)
//   - description (may contain internal URLs/info)
// Also rewrites manifest.json with content hashes so the dashboard can
// detect when a snapshot file has been updated and re-import it.
// Safe to run repeatedly — already-scrubbed files are left unchanged.

import { createHash } from 'crypto'
import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const snapshotsDir = join(__dirname, '../public/snapshots')

const files = readdirSync(snapshotsDir)
  .filter((f) => f.endsWith('.json') && f !== 'manifest.json')
  .sort()

let totalScrubbed = 0

const manifest = []

for (const file of files) {
  const filePath = join(snapshotsDir, file)
  let raw = readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw)

  if (!Array.isArray(data?.projects)) continue

  let changed = false
  for (const project of data.projects) {
    if (project.created_by_email) {
      project.created_by_email = ''
      changed = true
      totalScrubbed++
    }
    if (project.created_by) {
      project.created_by = 0
      changed = true
      totalScrubbed++
    }
    if (project.description) {
      project.description = ''
      changed = true
      totalScrubbed++
    }
  }

  if (changed) {
    raw = JSON.stringify(data, null, 2)
    writeFileSync(filePath, raw, 'utf-8')
    console.log(`Scrubbed: ${file}`)
  }

  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 16)
  manifest.push({ filename: file, hash })
}

const manifestPath = join(snapshotsDir, 'manifest.json')
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
console.log(`Done. ${totalScrubbed} field(s) redacted. Manifest updated with ${manifest.length} entries.`)
