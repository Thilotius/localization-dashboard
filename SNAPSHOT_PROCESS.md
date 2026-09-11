# Snapshot Update Process

This document describes how to maintain the Localization Dashboard's data snapshots and the architecture that powers them.

## Overview

The dashboard is a **static, client-side React/Vite app** that visualizes Lokalise project data across multiple snapshots over time. There is no backend API — all data is imported into browser IndexedDB on page load.

**Key constraint:** The repo is public; any file in `public/snapshots/` appears on GitHub and eventually GitHub Pages. **Personal data must be redacted before any snapshot is committed.**

## Architecture

```
Lokalise API
     ↓
fetch-snapshot.mjs (redacts PII)
     ↓
public/snapshots/YYYY-MM-DD_Lokalise_projects.json
     ↓
npm run scrub (updates manifest.json with content hashes)
     ↓
git commit + push
     ↓
GitHub Pages deploy (automatic)
     ↓
DashboardOverview.jsx: fetchAndImportMissingSnapshots()
     ↓
Dexie IndexedDB (uploads, projectSnapshots tables)
     ↓
React components render KPIs, coverage matrix, trends
```

## Snapshot Schema

Each snapshot is a JSON object with one key:

```json
{
  "projects": [
    {
      "project_id": "...",
      "project_type": "localization_files",
      "name": "Project Name",
      "description": "",  // MUST be empty (redacted for privacy)
      "created_at": "...",
      "created_at_timestamp": ...,
      "created_by": 0,  // MUST be 0 (redacted)
      "created_by_email": "",  // MUST be empty (redacted)
      "base_language_iso": "en",
      "statistics": {
        "progress_total": 80,  // % translated across all languages
        "keys_total": 1500,
        "base_words": 50000,
        "qa_issues_total": 250,
        "qa_issues": {
          "not_reviewed": 100,
          "spelling_grammar": 50,
          ...
        },
        "languages": [
          {
            "language_id": 123,
            "language_iso": "de_DE",
            "progress": 85,  // % of keys translated in this language
            "words_to_do": 7500
          }
        ]
      }
    }
  ]
}
```

**All fields are populated from the Lokalise API.** There is no manual curation of the JSON structure.

## Data Privacy & Security

### PII Redaction (Non-Negotiable)

Three fields **must be empty** in every committed snapshot:

- `project.created_by_email` → `""`
- `project.created_by` → `0`
- `project.description` → `""`

**Why:** The repo is public and pushes to GitHub Pages. Email addresses and user IDs are GDPR-linkable; descriptions often contain internal URLs or product details. Both get crawled by automated systems.

### API Token Handling

The Lokalise API token:

- **Never appears in any committed file** (no `.env` in repo, no hardcoded in scripts)
- **Passed via environment variable only:** `LOKALISE_API_TOKEN=xxx fetch-snapshot.mjs`
- **Rotated regularly** after each use in a transcript or committed file (though we never commit it)

The token's scope should be **read-only** (statistics + translations endpoint, no project writes).

## Updating a Snapshot

### Option A: Via API (Recommended)

Requires the `fetch-snapshot.mjs` script (see Fetching via API section below).

```bash
# In an interactive terminal:
LOKALISE_API_TOKEN=<your-token> npm run snapshot
npm run scrub
git add public/snapshots/*.json
git commit -m "Add YYYY-MM-DD snapshot"
git push
```

The script:
1. Fetches all projects from `GET /api2/projects?limit=100` (paginated)
2. Redacts `created_by`, `created_by_email`, `description` **before writing to disk**
3. Sorts projects by name (case-insensitive) for stable diffs
4. Writes `public/snapshots/YYYY-MM-DD_Lokalise_projects.json`

### Option B: Manual Export

1. Export from Lokalise UI or via a different tool
2. Run `scripts/fetch-snapshot.mjs` to redact and write to `public/snapshots/`
3. Continue at "Update the Manifest" below

### Update the Manifest

```bash
npm run scrub
```

This script:
- Reads all `.json` files in `public/snapshots/` (except `manifest.json`)
- Re-verifies PII redaction
- Computes a 16-char sha256 hash of each file's content
- Writes `public/snapshots/manifest.json` with filename + hash pairs

**Why:** When a snapshot file is modified (e.g., a re-export with different data), its hash changes, and the dashboard detects it needs re-import. Prevents stale data.

### Commit & Deploy

```bash
git add public/snapshots/
git commit -m "Add YYYY-MM-DD snapshot

Redacted created_by, created_by_email and description.
Manifest updated with content hash.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
git push origin main
```

This triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`), which builds and deploys to GitHub Pages. The new snapshot is fetched by the dashboard on next page load.

## Fetching via API

### Setup

Create `scripts/fetch-snapshot.mjs`:

```javascript
#!/usr/bin/env node
import { writeFileSync } from 'fs'

const token = process.env.LOKALISE_API_TOKEN
const dest = process.argv[2]
if (!token || !dest) throw new Error('need LOKALISE_API_TOKEN and dest path')

const LIMIT = 100
const projects = []
let page = 1
let pageCount = 1

do {
  const res = await fetch(
    `https://api.lokalise.com/api2/projects?limit=${LIMIT}&page=${page}`,
    { headers: { 'X-Api-Token': token } },
  )
  if (!res.ok) throw new Error(`Lokalise API ${res.status}: ${await res.text()}`)
  pageCount = Number(res.headers.get('x-pagination-page-count') ?? 1)
  const body = await res.json()
  projects.push(...(body.projects ?? []))
  page++
} while (page <= pageCount)

let redacted = 0
for (const project of projects) {
  if (project.created_by_email) { project.created_by_email = ''; redacted++ }
  if (project.created_by) { project.created_by = 0; redacted++ }
  if (project.description) { project.description = ''; redacted++ }
}

projects.sort((a, b) => String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase()))

writeFileSync(dest, JSON.stringify({ projects }, null, 2), 'utf-8')
console.log(`Wrote ${dest}: ${projects.length} projects, ${redacted} field(s) redacted.`)
```

Add to `package.json`:

```json
{
  "scripts": {
    "snapshot": "node scripts/fetch-snapshot.mjs public/snapshots/$(date +%Y-%m-%d)_Lokalise_projects.json",
    "scrub": "node scripts/scrub-snapshots.js"
  }
}
```

### Throughput

- **52 projects × ~29 languages ≈ 1,500 requests → ~5–6 min** if fetching per-language review data
- **52 projects only → ~15 sec** if fetching project-level totals
- API rate limit: ~4–5 requests/second (sustained)

### Example: Fetching Review Data

To add per-language review counts (future feature), extend the fetch loop:

```javascript
for (const project of projects) {
  const reviewedByLang = []
  for (const lang of project.statistics.languages) {
    const res = await fetch(
      `https://api.lokalise.com/api2/projects/${project.project_id}/translations?limit=1&filter_lang_id=${lang.language_id}&filter_is_reviewed=1`,
      { headers: { 'X-Api-Token': token } }
    )
    const reviewedCount = Number(res.headers.get('x-pagination-total-count') ?? 0)
    reviewedByLang.push({ language_id: lang.language_id, reviewed_count: reviewedCount })
  }
  project.statistics.reviewed_by_language = reviewedByLang
}
```

This adds a new field to the snapshot schema without breaking existing code (the frontend can ignore it until a feature is built to use it).

## Frontend Data Flow

1. **On page load:** [App.jsx](src/App.jsx) calls `fetchAndImportMissingSnapshots()`
2. **Manifest fetch:** [localizationDb.js:171](src/db/localizationDb.js#L171) reads `public/snapshots/manifest.json`
3. **Per-file check:** For each manifest entry, check if it's already in IndexedDB by `originalFileName` and `contentHash`
   - If hash matches an existing entry → skip (no change)
   - If hash differs → delete old entry and re-import new file
   - If new filename → fetch and import
4. **Data persist:** `saveLokaliseUpload()` creates one upload row and one projectSnapshots row per project
5. **Rendering:** [DashboardOverview.jsx](src/components/DashboardOverview.jsx) queries the latest upload and renders KPIs, coverage matrix, and trend charts

## Database Schema

**Dexie stores** (v2):

```javascript
db.version(2).stores({
  uploads: '++id, importedAt, originalFileName',
  projectSnapshots: '++id, projectId, uploadId, importedAt, projectName, baseLanguageIso',
})
```

**uploads** (one row per imported file):
- `id, importedAt, originalFileName, projectCount, contentHash`

**projectSnapshots** (one row per project per upload):
- `id, uploadId, importedAt, projectId, projectName, projectType, teamId, baseLanguageIso, createdAtTimestamp`
- `progressTotal, keysTotal, baseWords, qaIssuesTotal`
- `languages: Array<{languageId, languageIso, progress, wordsToDo}>`

## Troubleshooting

### New snapshot doesn't appear
- Check `npm run scrub` output — are all projects PII-free?
- Verify the deploy ran: `.github/workflows/deploy.yml` in Actions
- Clear browser cache and check IndexedDB in DevTools

### Snapshot appears stale
- Manifest hash mismatch? Re-run `npm run scrub` and recommit
- File was updated after manifest was written? Re-fetch and re-scrub

### API token fails
- Token is read-only? Regenerate if you're unsure
- Rate limit hit? Wait ~60s, Lokalise resets per-minute buckets

## Future: Review Percentage Feature

**Status:** Requires extended snapshot schema with per-language review counts (not yet implemented).

**Details:** See [Contributing > Reviewed Translations](CONTRIBUTING.md) if that doc exists, or ask the maintainer.

**Data flow when implemented:**
1. Fetch script adds `reviewed_by_language` to each project's statistics
2. `normalizeLokaliseProjects()` reads and stores `reviewedByLanguageIso: {...}`
3. Dashboard table renders "Translated / Reviewed" side-by-side
4. Trend chart shows review % over time

**Cost:** ~5–6 min per snapshot fetch (due to 1,500 per-language API requests).
