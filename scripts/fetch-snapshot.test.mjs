import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { fetchAllProjects, getSnapshotPath, run } from './fetch-snapshot.mjs'

function createHeaders(values = {}) {
  const entries = new Map(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]),
  )

  return {
    get(name) {
      return entries.get(String(name).toLowerCase()) ?? null
    },
  }
}

function createResponse({
  ok = true,
  status = 200,
  headers = {},
  jsonBody = {},
  textBody = '',
} = {}) {
  return {
    ok,
    status,
    headers: createHeaders(headers),
    async json() {
      return jsonBody
    },
    async text() {
      return textBody
    },
  }
}

test('run fails clearly when the Lokalise token is missing', async () => {
  const snapshotsDir = await mkdtemp(join(tmpdir(), 'snapshot-missing-token-'))

  await assert.rejects(
    run({
      env: {},
      snapshotsDir,
      fetchImpl: async () => {
        throw new Error('fetch should not be called')
      },
    }),
    /Missing LOKALISE_API_TOKEN environment variable\./,
  )
})

test('run fetches paginated projects, redacts sensitive fields, and sorts deterministically', async () => {
  const snapshotsDir = await mkdtemp(join(tmpdir(), 'snapshot-success-'))
  const now = new Date('2026-09-11T15:05:27.338Z')
  const calls = []

  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options })

    if (calls.length === 1) {
      return createResponse({
        headers: { 'x-pagination-page-count': '2' },
        jsonBody: {
          projects: [
            {
              project_id: '2',
              name: 'beta',
              created_by_email: 'private@example.com',
              created_by: 123,
              description: 'internal',
            },
          ],
        },
      })
    }

    return createResponse({
      headers: { 'x-pagination-page-count': '2' },
      jsonBody: {
        projects: [
          {
            project_id: '1',
            name: 'Alpha',
            created_by_email: 'alpha@example.com',
            created_by: 456,
            description: 'secret',
          },
        ],
      },
    })
  }

  const result = await run({
    env: { LOKALISE_API_TOKEN: 'token-value' },
    snapshotsDir,
    now,
    fetchImpl,
  })

  assert.equal(calls.length, 2)
  assert.match(calls[0].url, /page=1/)
  assert.match(calls[1].url, /page=2/)
  assert.equal(calls[0].options.method, 'GET')
  assert.equal(calls[0].options.headers['X-Api-Token'], 'token-value')

  const outputPath = getSnapshotPath({ snapshotsDir, now })
  assert.equal(result.outputPath, outputPath)

  const payload = JSON.parse(await readFile(outputPath, 'utf-8'))
  assert.deepEqual(
    payload.projects.map((project) => project.name),
    ['Alpha', 'beta'],
  )
  assert.deepEqual(
    payload.projects.map(({ created_by_email, created_by, description }) => ({
      created_by_email,
      created_by,
      description,
    })),
    [
      { created_by_email: '', created_by: 0, description: '' },
      { created_by_email: '', created_by: 0, description: '' },
    ],
  )
})

test('run refuses to overwrite an existing dated snapshot unless explicitly allowed', async () => {
  const snapshotsDir = await mkdtemp(join(tmpdir(), 'snapshot-overwrite-'))
  const now = new Date('2026-09-11T15:05:27.338Z')
  const outputPath = getSnapshotPath({ snapshotsDir, now })
  let fetchCalled = false

  await writeFile(outputPath, '{"projects":[]}\n', 'utf-8')

  await assert.rejects(
    run({
      env: { LOKALISE_API_TOKEN: 'token-value' },
      snapshotsDir,
      now,
      fetchImpl: async () => {
        fetchCalled = true
        return createResponse({ headers: { 'x-pagination-page-count': '1' }, jsonBody: { projects: [] } })
      },
    }),
    /Refusing to overwrite without --overwrite\./,
  )

  assert.equal(fetchCalled, false)
})

test('fetchAllProjects fails clearly on malformed API responses', async () => {
  await assert.rejects(
    fetchAllProjects({
      token: 'token-value',
      fetchImpl: async () => createResponse({
        headers: { 'x-pagination-page-count': '1' },
        jsonBody: { projects: null },
      }),
    }),
    /Malformed Lokalise API response on page 1/,
  )
})
