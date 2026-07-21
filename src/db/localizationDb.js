import Dexie from 'dexie'

// Local, browser-based database for the Localization Dashboard.
// Every imported Lokalise_projects.json file becomes an "upload" row.
// Each project within that file becomes a "projectSnapshots" row so we
// can analyze progress over time and filter per project.

export const db = new Dexie('localizationDashboard')

db.version(1).stores({
  uploads: '++id, importedAt',
  projectSnapshots:
    '++id, projectId, uploadId, importedAt, projectName, baseLanguageIso',
})

// v2 adds an index on originalFileName so we can cheaply check for duplicates
// when auto-importing snapshots from public/snapshots/.
db.version(2).stores({
  // One row per imported file.
  // Shape:
  // {
  //   id: number
  //   importedAt: Date
  //   originalFileName: string
  //   projectCount: number
  // }
  uploads: '++id, importedAt, originalFileName',

  // One row per project per upload.
  // We denormalize importedAt to make time-series queries simpler.
  // Shape (derived from the sample Lokalise_projects.json):
  // {
  //   id: number
  //   uploadId: number
  //   importedAt: Date
  //   projectId: string
  //   projectName: string
  //   projectType: string
  //   teamId: number
  //   baseLanguageIso: string // e.g. "en"
  //   createdAtTimestamp: number
  //   progressTotal: number    // statistics.progress_total
  //   keysTotal: number        // statistics.keys_total
  //   baseWords: number        // statistics.base_words
  //   qaIssuesTotal: number    // statistics.qa_issues_total
  //   languages: Array<{
  //     languageId: number
  //     languageIso: string
  //     progress: number
  //     wordsToDo: number
  //   }>
  // }
  projectSnapshots:
    '++id, projectId, uploadId, importedAt, projectName, baseLanguageIso',
})


/**
 * Create an upload entry. importedAt defaults to now but can be overridden
 * so that auto-imported snapshots reflect their actual export date.
 */
export async function createUploadSnapshot({
  originalFileName = 'Lokalise_projects.json',
  projectCount = 0,
  importedAt = new Date(),
  contentHash = null,
} = {}) {
  const uploadId = await db.uploads.add({
    importedAt,
    originalFileName,
    projectCount,
    contentHash,
  })

  return { uploadId, importedAt }
}

/**
 * Normalize the "projects" array from a Lokalise_projects.json file
 * into the shape we persist in the projectSnapshots table.
 *
 * This is pure data transformation and does not touch Dexie directly,
 * which keeps it easy to test and reuse.
 */
export function normalizeLokaliseProjects(rawJson, { uploadId, importedAt }) {
  const projects = rawJson && Array.isArray(rawJson.projects)
    ? rawJson.projects
    : []

  return projects.map((project) => {
    const statistics = project.statistics ?? {}
    const languages = Array.isArray(statistics.languages)
      ? statistics.languages
      : []

    return {
      uploadId,
      importedAt,
      projectId: project.project_id ?? null,
      projectName: project.name ?? '',
      projectType: project.project_type ?? '',
      teamId: project.team_id ?? null,
      baseLanguageIso: project.base_language_iso ?? null,
      createdAtTimestamp: project.created_at_timestamp ?? null,
      progressTotal: statistics.progress_total ?? null,
      keysTotal: statistics.keys_total ?? null,
      baseWords: statistics.base_words ?? null,
      qaIssuesTotal: statistics.qa_issues_total ?? null,
      languages: languages.map((lang) => ({
        languageId: lang.language_id ?? null,
        languageIso: lang.language_iso ?? null,
        progress: lang.progress ?? null,
        wordsToDo: lang.words_to_do ?? null,
      })),
    }
  })
}

/**
 * High-level helper that, given the parsed Lokalise_projects.json object,
 * creates an upload row and persists one snapshot per project.
 *
 * This will be called from the Phase 3 drag-and-drop upload flow.
 */
export async function saveLokaliseUpload(rawJson, {
  originalFileName = 'Lokalise_projects.json',
  importedAt = new Date(),
  contentHash = null,
} = {}) {
  const projects = rawJson && Array.isArray(rawJson.projects)
    ? rawJson.projects
    : []

  const projectCount = projects.length

  const { uploadId } = await createUploadSnapshot({
    originalFileName,
    projectCount,
    importedAt,
    contentHash,
  })

  const snapshots = normalizeLokaliseProjects(rawJson, { uploadId, importedAt })

  if (snapshots.length > 0) {
    await db.projectSnapshots.bulkAdd(snapshots)
  }

  return {
    uploadId,
    importedAt,
    projectCount,
  }
}

function parseDateFromFilename(filename) {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/)
  // Use noon UTC to avoid timezone-induced date shifts
  return match ? new Date(`${match[1]}T12:00:00Z`) : null
}

// Module-level lock: prevents React StrictMode's double-invocation from
// importing the same files twice in a single page load.
let syncInProgress = false

/**
 * Fetches public/snapshots/manifest.json, compares listed files against
 * IndexedDB, and imports any that are new or have changed (via content hash).
 * Safe to call on every page load.
 */
export async function fetchAndImportMissingSnapshots() {
  if (syncInProgress) return { imported: 0 }
  syncInProgress = true

  try {
    const manifestResponse = await fetch('./snapshots/manifest.json')
    if (!manifestResponse.ok) return { imported: 0 }

    const manifest = await manifestResponse.json()
    if (!Array.isArray(manifest) || manifest.length === 0) return { imported: 0 }

    // Support both old format (array of strings) and new format (array of {filename, hash})
    const entries = manifest.map((entry) =>
      typeof entry === 'string' ? { filename: entry, hash: null } : entry,
    )

    const existingUploads = await db.uploads.toArray()
    const uploadByFilename = new Map(existingUploads.map((u) => [u.originalFileName, u]))
    const existingDates = new Set(
      existingUploads
        .map((u) => (u.importedAt instanceof Date ? u.importedAt.toISOString().slice(0, 10) : null))
        .filter(Boolean),
    )

    let imported = 0
    for (const { filename, hash } of entries) {
      const existing = uploadByFilename.get(filename)

      if (existing) {
        // Skip if hash matches — file unchanged
        if (hash && existing.contentHash === hash) continue

        // Hash changed: delete old upload and its snapshots, then re-import
        if (hash && existing.contentHash !== hash) {
          await db.projectSnapshots.where('uploadId').equals(existing.id).delete()
          await db.uploads.delete(existing.id)
        } else {
          // No hash in manifest (old format) — fall back to skipping by filename
          continue
        }
      } else {
        // New file: also skip if another upload already covers this date
        const parsed = parseDateFromFilename(filename)
        if (parsed && existingDates.has(parsed.toISOString().slice(0, 10))) continue
      }

      const fileResponse = await fetch(`./snapshots/${filename}`)
      if (!fileResponse.ok) continue
      const json = await fileResponse.json()
      const importedAt = parseDateFromFilename(filename) ?? new Date()
      await saveLokaliseUpload(json, { originalFileName: filename, importedAt, contentHash: hash })
      imported++
    }

    return { imported }
  } finally {
    syncInProgress = false
  }
}

