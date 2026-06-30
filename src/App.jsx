import { useEffect, useState } from 'react'
import { DashboardOverview } from './components/DashboardOverview'
import { fetchAndImportMissingSnapshots } from './db/localizationDb'

function App() {
  const [syncStatus, setSyncStatus] = useState(null) // null | 'syncing' | 'done' | 'error'

  useEffect(() => {
    setSyncStatus('syncing')
    fetchAndImportMissingSnapshots()
      .then(({ imported }) => {
        setSyncStatus(imported > 0 ? 'done' : null)
      })
      .catch(() => setSyncStatus('error'))
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white">
              L10n
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-slate-900">
                Localization Dashboard
              </p>
              <p className="text-xs text-slate-500">
                EGYM · Internal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            {syncStatus === 'syncing' && (
              <span className="text-slate-400">Loading snapshots…</span>
            )}
            {syncStatus === 'done' && (
              <span className="text-emerald-600">Snapshots loaded</span>
            )}
            {syncStatus === 'error' && (
              <span className="text-rose-500">Failed to load snapshots</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-6 py-10">
        <section className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
            Welcome
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Localization Project Overview
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">
            Translation status, language coverage, and progress over time across all
            EGYM Lokalise projects. Snapshots are updated periodically by the localization team.
          </p>
        </section>

        <DashboardOverview />
      </main>
    </div>
  )
}

export default App
