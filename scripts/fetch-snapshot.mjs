#!/usr/bin/env node

import { access, mkdir, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_SNAPSHOTS_DIR = join(__dirname, '../public/snapshots')
const LOKALISE_PROJECTS_URL = 'https://api.lokalise.com/api2/projects'
const PAGE_LIMIT = 500
const NAME_COLLATOR = new Intl.Collator('en', { sensitivity: 'base' })

function getEnv(env, key) {
  return typeof env?.[key] === 'string' ? env[key].trim() : ''
}

function formatSnapshotDate(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

export function getSnapshotPath({
  snapshotsDir = DEFAULT_SNAPSHOTS_DIR,
  now = new Date(),
} = {}) {
  return join(snapshotsDir, `${formatSnapshotDate(now)}_Lokalise_projects.json`)
}

function parsePageCount(headers) {
  const raw = headers?.get?.('x-pagination-page-count') ?? '1'
  const pageCount = Number.parseInt(raw, 10)

  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error(`Malformed Lokalise pagination header x-pagination-page-count=${JSON.stringify(raw)}`)
  }

  return pageCount
}

function formatHttpError(status, bodyText) {
  const detail = bodyText.trim()
  return detail
    ? `Lokalise API request failed with ${status}: ${detail}`
    : `Lokalise API request failed with ${status}.`
}

async function fetchProjectsPage({ token, page, limit, fetchImpl }) {
  const url = new URL(LOKALISE_PROJECTS_URL)
  url.searchParams.set('page', String(page))
  url.searchParams.set('limit', String(limit))

  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      'X-Api-Token': token,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(formatHttpError(response.status, await response.text()))
  }

  let body
  try {
    body = await response.json()
  } catch (error) {
    throw new Error(`Lokalise API returned invalid JSON on page ${page}: ${error.message}`)
  }

  if (!body || typeof body !== 'object' || !Array.isArray(body.projects)) {
    throw new Error(`Malformed Lokalise API response on page ${page}: expected a JSON object with a projects array.`)
  }

  return {
    pageCount: parsePageCount(response.headers),
    projects: body.projects,
  }
}

export async function fetchAllProjects({
  token,
  fetchImpl = globalThis.fetch,
  limit = PAGE_LIMIT,
} = {}) {
  if (!token) {
    throw new Error('Missing LOKALISE_API_TOKEN environment variable.')
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch API is unavailable in this Node.js runtime.')
  }

  const projects = []
  let page = 1
  let pageCount = 1

  do {
    const result = await fetchProjectsPage({ token, page, limit, fetchImpl })
    pageCount = result.pageCount
    projects.push(...result.projects)
    page += 1
  } while (page <= pageCount)

  return projects
}

export function redactAndSortProjects(projects) {
  return [...projects]
    .map((project) => ({
      ...project,
      created_by_email: '',
      created_by: 0,
      description: '',
    }))
    .sort((left, right) => {
      const leftName = typeof left?.name === 'string' ? left.name : ''
      const rightName = typeof right?.name === 'string' ? right.name : ''

      return NAME_COLLATOR.compare(leftName, rightName)
        || leftName.localeCompare(rightName)
        || String(left?.project_id ?? '').localeCompare(String(right?.project_id ?? ''))
    })
}

async function assertWritableDestination(outputPath, overwrite) {
  try {
    await access(outputPath, constants.F_OK)
  } catch {
    return
  }

  if (!overwrite) {
    throw new Error(`Snapshot already exists at ${outputPath}. Refusing to overwrite without --overwrite.`)
  }
}

export async function writeSnapshot({
  outputPath,
  projects,
  overwrite = false,
} = {}) {
  await assertWritableDestination(outputPath, overwrite)
  await mkdir(dirname(outputPath), { recursive: true })
  const payload = JSON.stringify({ projects }, null, 2)
  await writeFile(outputPath, `${payload}\n`, 'utf-8')
}

export async function run({
  env = process.env,
  argv = process.argv.slice(2),
  fetchImpl = globalThis.fetch,
  snapshotsDir = DEFAULT_SNAPSHOTS_DIR,
  now = new Date(),
} = {}) {
  const token = getEnv(env, 'LOKALISE_API_TOKEN')
  if (!token) {
    throw new Error('Missing LOKALISE_API_TOKEN environment variable.')
  }

  const overwrite = argv.includes('--overwrite')
  const outputPath = getSnapshotPath({ snapshotsDir, now })
  await assertWritableDestination(outputPath, overwrite)

  const projects = redactAndSortProjects(await fetchAllProjects({ token, fetchImpl }))
  await writeSnapshot({ outputPath, projects, overwrite: true })

  return { outputPath, projectCount: projects.length }
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]

if (isDirectExecution) {
  run()
    .then(({ outputPath, projectCount }) => {
      console.log(`Wrote ${outputPath} with ${projectCount} redacted Lokalise projects.`)
    })
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
