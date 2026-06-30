import { useState, useCallback } from 'react'
import { saveLokaliseUpload } from '../db/localizationDb'

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

export function UploadPanel() {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState(null)

  const handleDragOver = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()
    if (!isDragging) {
      setIsDragging(true)
    }
  }, [isDragging])

  const clearDragState = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()
    if (isDragging) {
      setIsDragging(false)
    }
  }, [isDragging])

  const handleDrop = useCallback(
    async (event) => {
      event.preventDefault()
      event.stopPropagation()
      setIsDragging(false)

      const file = event.dataTransfer?.files?.[0]
      if (!file) return

      if (!file.name.toLowerCase().endsWith('.json')) {
        setStatus({
          type: 'error',
          message: 'Please drop a JSON file (e.g. Lokalise_projects.json).',
        })
        return
      }

      setIsProcessing(true)
      setStatus(null)

      try {
        const text = await readFileAsText(file)
        const parsed = JSON.parse(text)

        const { uploadId, importedAt, projectCount } = await saveLokaliseUpload(
          parsed,
          { originalFileName: file.name },
        )

        setStatus({
          type: 'success',
          message: `Imported ${projectCount} projects from "${file.name}".`,
          meta: {
            uploadId,
            importedAt: importedAt.toISOString(),
          },
        })
      } catch (error) {
        console.error('Failed to process upload', error)
        setStatus({
          type: 'error',
          message:
            'Something went wrong while reading or parsing this file. Please make sure it is a valid Lokalise_projects.json export.',
        })
      } finally {
        setIsProcessing(false)
      }
    },
    [],
  )

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold tracking-tight text-slate-900">
        Data ingestion
      </h2>
      <p className="mt-2 text-xs text-slate-600">
        Drag and drop your <span className="font-medium">Lokalise_projects.json</span>{' '}
        export here. Each upload is stored locally with a timestamp so you can track
        progress over time.
      </p>

      <div
        className={[
          'mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors',
          isDragging
            ? 'border-slate-900 bg-slate-50/80'
            : 'border-slate-300 bg-slate-100/60 hover:border-slate-400',
        ].join(' ')}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={clearDragState}
        onDrop={handleDrop}
      >
        <p className="text-sm font-medium text-slate-900">
          {isProcessing ? 'Importing data…' : 'Drop your Lokalise_projects.json here'}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Files stay on this machine only. No data is sent to any server.
        </p>
      </div>

      {status && (
        <div
          className={[
            'mt-4 rounded-lg border px-3 py-2 text-xs',
            status.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800',
          ].join(' ')}
        >
          <p className="font-medium">
            {status.type === 'success' ? 'Upload saved' : 'Upload failed'}
          </p>
          <p className="mt-1 text-[0.78rem] leading-relaxed">{status.message}</p>
        </div>
      )}
    </section>
  )
}

