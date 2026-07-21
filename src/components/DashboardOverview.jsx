import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { PRODUCT_GROUPS } from '../config/productGroups'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { db } from '../db/localizationDb'

const CONSOLIDATED_LANGUAGE_GROUPS = [
  { key: 'ca-ES', label: 'Catalan (Spain)', codes: ['ca', 'ca_ES'] },
  { key: 'en-US', label: 'English (US)', codes: ['en', 'en-US', 'en_US'] },
  { key: 'en-GB', label: 'English (UK)', codes: ['en_GB'] },
  { key: 'en-AU', label: 'English (Australia)', codes: ['en_AU'] },
  { key: 'en-CA', label: 'English (Canada)', codes: ['en_CA'] },
  { key: 'de-DE', label: 'German (Germany)', codes: ['de', 'de-DE', 'de_DE'] },
  { key: 'fr-FR', label: 'French (France)', codes: ['fr', 'fr-FR', 'fr_FR'] },
  { key: 'fr-CA', label: 'French (Canada)', codes: ['fr_CA'] },
  { key: 'es-ES', label: 'Spanish (Spain)', codes: ['es', 'es-ES', 'es_ES'] },
  { key: 'es-MX', label: 'Spanish (Mexico)', codes: ['es_MX'] },
  { key: 'es-419', label: 'Spanish (Latin America)', codes: ['es_419'] },
  { key: 'it-IT', label: 'Italian (Italy)', codes: ['it', 'it-IT', 'it_IT'] },
  { key: 'pt-PT', label: 'Portuguese (Portugal)', codes: ['pt', 'pt_PT'] },
  { key: 'nl-NL', label: 'Dutch (Netherlands)', codes: ['nl', 'nl-NL', 'nl_NL'] },
  { key: 'nl-BE', label: 'Dutch (Belgium)', codes: ['nl_BE'] },
  { key: 'pl-PL', label: 'Polish (Poland)', codes: ['pl', 'pl-PL', 'pl_PL'] },
  { key: 'cs-CZ', label: 'Czech (Czechia)', codes: ['cs', 'cs_CZ'] },
  { key: 'ro-RO', label: 'Romanian (Romania)', codes: ['ro-RO', 'ro_RO'] },
  { key: 'bg-BG', label: 'Bulgarian (Bulgaria)', codes: ['bg_BG'] },
  { key: 'el-GR', label: 'Greek (Greece)', codes: ['el_GR'] },
  { key: 'sv-SE', label: 'Swedish (Sweden)', codes: ['sv', 'sv_SE'] },
  { key: 'da-DK', label: 'Danish (Denmark)', codes: ['da', 'da_DK'] },
  { key: 'fi-FI', label: 'Finnish (Finland)', codes: ['fi', 'fi_FI'] },
  { key: 'is-IS', label: 'Icelandic (Iceland)', codes: ['is_IS'] },
  { key: 'nb-NO', label: 'Norwegian Bokmål (Norway)', codes: ['nb', 'no', 'nb-NO', 'nb_NO', 'no_NO'] },
  { key: 'tr-TR', label: 'Turkish (Turkiye)', codes: ['tr', 'tr_TR'] },
  { key: 'ru-RU', label: 'Russian (Russia)', codes: ['ru_RU'] },
  { key: 'uk-UA', label: 'Ukrainian (Ukraine)', codes: ['uk', 'uk_UA'] },
  { key: 'be-BY', label: 'Belarusian (Belarus)', codes: ['be_BY'] },
  { key: 'ja-JP', label: 'Japanese (Japan)', codes: ['ja', 'ja_JP'] },
  { key: 'ko-KR', label: 'Korean (Korea)', codes: ['ko', 'ko_KR'] },
  { key: 'zh-Hans', label: 'Chinese (Simplified)', codes: ['zh_CN', 'zh_Hans_CN'] },
  { key: 'zh-Hant', label: 'Chinese (Traditional)', codes: ['zh_TW'] },
  { key: 'ar-AE', label: 'Arabic (UAE)', codes: ['ar_AE'] },
  { key: 'he-IL', label: 'Hebrew (Israel)', codes: ['he', 'he_IL'] },
  { key: 'th-TH', label: 'Thai (Thailand)', codes: ['th', 'th-TH', 'th_TH'] },
  { key: 'cy-GB', label: 'Welsh (United Kingdom)', codes: ['cy_GB'] },
]

function normalizeLanguageCode(code) {
  if (!code) return ''
  return String(code).trim().replace(/_/g, '-')
}

const consolidatedAliasToKey = CONSOLIDATED_LANGUAGE_GROUPS.reduce((acc, group) => {
  group.codes.forEach((code) => {
    acc[normalizeLanguageCode(code).toLowerCase()] = group.key
  })
  acc[normalizeLanguageCode(group.key).toLowerCase()] = group.key
  return acc
}, {})

const predefinedConsolidatedByKey = CONSOLIDATED_LANGUAGE_GROUPS.reduce((acc, group) => {
  acc[group.key] = group
  return acc
}, {})

const DEFAULT_REGION_BY_LANGUAGE = {
  ar: 'SA',
  be: 'BY',
  bg: 'BG',
  ca: 'ES',
  cs: 'CZ',
  da: 'DK',
  de: 'DE',
  en: 'US',
  es: 'ES',
  et: 'EE',
  fi: 'FI',
  fr: 'FR',
  he: 'IL',
  it: 'IT',
  ja: 'JP',
  ko: 'KR',
  lt: 'LT',
  lv: 'LV',
  nb: 'NO',
  nl: 'NL',
  no: 'NO',
  pl: 'PL',
  pt: 'PT',
  ro: 'RO',
  ru: 'RU',
  sk: 'SK',
  sl: 'SI',
  sv: 'SE',
  tr: 'TR',
  uk: 'UA',
  zh: 'CN',
}

function getConsolidatedLanguageKey(code) {
  const normalized = normalizeLanguageCode(code).toLowerCase()
  return consolidatedAliasToKey[normalized] ?? normalizeLanguageCode(code)
}

function parseLanguageCodeParts(code) {
  const normalized = normalizeLanguageCode(code)
  const parts = normalized.split('-').filter(Boolean)
  if (parts.length === 0) {
    return { language: '', script: null, region: null }
  }

  const language = parts[0].toLowerCase()
  let script = null
  let region = null

  parts.slice(1).forEach((part) => {
    if (part.length === 4 && !script) {
      script = part[0].toUpperCase() + part.slice(1).toLowerCase()
      return
    }
    if ((part.length === 2 || part.length === 3) && !region) {
      region = part.toUpperCase()
    }
  })

  return { language, script, region }
}

function buildDynamicConsolidationGroups(rawCodes) {
  const dynamicGroups = {}

  rawCodes.forEach((rawCode) => {
    if (!rawCode) return
    const predefinedKey = getConsolidatedLanguageKey(rawCode)
    if (predefinedConsolidatedByKey[predefinedKey]) {
      return
    }

    const { language, script, region } = parseLanguageCodeParts(rawCode)
    if (!language) return

    const fallbackRegion = region ?? DEFAULT_REGION_BY_LANGUAGE[language] ?? 'ZZ'
    const dynamicKey = script
      ? `${language}-${script}-${fallbackRegion}`
      : `${language}-${fallbackRegion}`
    const existing = dynamicGroups[dynamicKey]

    if (!existing) {
      dynamicGroups[dynamicKey] = {
        key: dynamicKey,
        label: '',
        codes: [String(rawCode).trim()],
      }
      return
    }

    const codeAsSeen = String(rawCode).trim()
    if (!existing.codes.includes(codeAsSeen)) {
      existing.codes.push(codeAsSeen)
    }
  })

  const languageDisplayNames = new Intl.DisplayNames(undefined, { type: 'language' })
  const regionDisplayNames = new Intl.DisplayNames(undefined, { type: 'region' })

  Object.values(dynamicGroups).forEach((group) => {
    const { language, region } = parseLanguageCodeParts(group.key)
    const languageName = languageDisplayNames.of(language) ?? language.toUpperCase()
    const regionName = region === 'ZZ'
      ? 'Unspecified'
      : (regionDisplayNames.of(region) ?? region)
    group.label = `${languageName} (${regionName})`
    group.codes.sort()
  })

  return dynamicGroups
}

function getLanguageDisplayLabel(code, consolidatedView, consolidatedByKey) {
  if (!consolidatedView) return code
  const key = getConsolidatedLanguageKey(code)
  const group = consolidatedByKey[key] ?? consolidatedByKey[normalizeLanguageCode(code)]
  if (!group) return key
  return `${group.label} [${group.codes.join(', ')}]`
}

function resolveConsolidatedGroupKey(code) {
  const normalizedCode = normalizeLanguageCode(code)
  const predefinedKey = getConsolidatedLanguageKey(normalizedCode)
  if (predefinedConsolidatedByKey[predefinedKey]) {
    return predefinedKey
  }

  const { language, script, region } = parseLanguageCodeParts(normalizedCode)
  const fallbackRegion = region ?? DEFAULT_REGION_BY_LANGUAGE[language] ?? 'ZZ'
  return script
    ? `${language}-${script}-${fallbackRegion}`
    : `${language}-${fallbackRegion}`
}

function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function formatPercent(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value.toFixed(0)}%`
}

function formatDateTime(value) {
  if (!value) return '—'
  try {
    const date = value instanceof Date ? value : new Date(value)
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function formatShortDate(value) {
  if (!value) return '—'
  try {
    const date = value instanceof Date ? value : new Date(value)
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    })
  } catch {
    return '—'
  }
}

function getProgressBgColor(pct) {
  if (pct === null) return 'text-slate-400';
  if (pct >= 90) return 'bg-emerald-100 text-emerald-800 font-bold';
  if (pct >= 60) return 'bg-amber-100 text-amber-800 font-semibold';
  return 'bg-rose-100 text-rose-800 font-semibold';
}

// Projects belonging to excluded groups (e.g. test/demo) are stripped from all data
const excludedProjectNames = new Set(
  PRODUCT_GROUPS.filter((g) => g.excluded).flatMap((g) => g.projectNames),
)

// projectName → array of product keys it belongs to (built once from config)
const projectNameToProductKeys = new Map()
PRODUCT_GROUPS.forEach((group) => {
  if (group.excluded) return
  group.projectNames.forEach((name) => {
    const existing = projectNameToProductKeys.get(name) ?? []
    existing.push(group.key)
    projectNameToProductKeys.set(name, existing)
  })
})

export function DashboardOverview() {
  const [search, setSearch] = useState('')
  const [selectedProducts, setSelectedProducts] = useState([])
  const [selectedLanguages, setSelectedLanguages] = useState([])
  const [consolidatedLanguageView, setConsolidatedLanguageView] = useState(true)
  const [visibleSeries, setVisibleSeries] = useState({
    totalBaseWords: true,
    distinctLanguages: true,
    totalProjects: true,
    averageProgress: true,
  })
  const [tableHeight, setTableHeight] = useState(560)
  const [coverageHeight, setCoverageHeight] = useState(560)
  const [languageAnalyticsSort, setLanguageAnalyticsSort] = useState('coverage-desc')
  const resizeStartYRef = useRef(0)
  const resizeStartHeightRef = useRef(560)
  const coverageResizeStartYRef = useRef(0)
  const coverageResizeStartHeightRef = useRef(560)

  const data = useLiveQuery(
    async () => {
      const latestUpload = await db.uploads.orderBy('importedAt').last()
      if (!latestUpload) {
        return { latestUpload: null, snapshots: [] }
      }

      const snapshots = await db.projectSnapshots
        .where('uploadId')
        .equals(latestUpload.id)
        .toArray()

      return { latestUpload, snapshots }
    },
    [],
    { latestUpload: null, snapshots: [] },
  )

  const { latestUpload, snapshots } = data ?? { latestUpload: null, snapshots: [] }
  const historySeries = useLiveQuery(
    async () => {
      const uploads = await db.uploads.orderBy('importedAt').toArray()
      if (uploads.length === 0) {
        return []
      }

      const uploadIds = uploads.map((upload) => upload.id)
      const allSnapshots = await db.projectSnapshots
        .where('uploadId')
        .anyOf(uploadIds)
        .toArray()

      const snapshotsByUploadId = new Map()
      allSnapshots.forEach((snapshot) => {
        const bucket = snapshotsByUploadId.get(snapshot.uploadId) ?? []
        bucket.push(snapshot)
        snapshotsByUploadId.set(snapshot.uploadId, bucket)
      })

      return uploads.map((upload) => {
        const uploadSnapshots = (snapshotsByUploadId.get(upload.id) ?? []).filter(
          (s) => !excludedProjectNames.has(s.projectName),
        )
        const totalProjects = uploadSnapshots.length

        const totalBaseWords = uploadSnapshots.reduce(
          (acc, snapshot) => acc + (snapshot.baseWords ?? 0),
          0,
        )
        const progressSum = uploadSnapshots.reduce(
          (acc, snapshot) => acc + (snapshot.progressTotal ?? 0),
          0,
        )
        const averageProgress = totalProjects > 0 ? progressSum / totalProjects : null

        const languageSet = new Set()
        uploadSnapshots.forEach((snapshot) => {
          if (!Array.isArray(snapshot.languages)) return
          snapshot.languages.forEach((lang) => {
            if (lang?.languageIso) {
              languageSet.add(lang.languageIso)
            }
          })
        })

        return {
          uploadId: upload.id,
          importedAt: upload.importedAt,
          dateLabel: formatShortDate(upload.importedAt),
          totalProjects,
          averageProgress,
          totalBaseWords,
          distinctLanguages: languageSet.size,
        }
      })
    },
    [],
    [],
  )

  const {
    kpis,
    filteredSnapshots,
    languageOptions,
    consolidatedByKey,
    languageCoverageRows,
    languagesAboveNinetyPct,
    totalConsolidatedLanguages,
    overallWeightedCoveragePct,
  } = useMemo(() => {
    if (!snapshots || snapshots.length === 0) {
      return {
        kpis: {
          totalProjects: 0,
          averageProgress: null,
          totalBaseWords: 0,
          distinctLanguages: 0,
        },
        filteredSnapshots: [],
        languageOptions: [],
        consolidatedByKey: predefinedConsolidatedByKey,
        languageCoverageRows: [],
        languagesAboveNinetyPct: 0,
        totalConsolidatedLanguages: 0,
        overallWeightedCoveragePct: null,
      }
    }

    const baseSnapshots = snapshots.filter((s) => !excludedProjectNames.has(s.projectName))

    const totalProjects = baseSnapshots.length
    const sumProgress = baseSnapshots.reduce(
      (acc, item) => acc + (item.progressTotal ?? 0),
      0,
    )
    const averageProgress = totalProjects > 0 ? sumProgress / totalProjects : null

    const totalBaseWords = baseSnapshots.reduce(
      (acc, item) => acc + (item.baseWords ?? 0),
      0,
    )

    const rawLanguageCodes = new Set()
    const languageSet = new Set()
    baseSnapshots.forEach((snap) => {
      if (Array.isArray(snap.languages)) {
        snap.languages.forEach((lang) => {
          if (lang?.languageIso) {
            rawLanguageCodes.add(normalizeLanguageCode(lang.languageIso))
            const languageCode = consolidatedLanguageView
              ? getConsolidatedLanguageKey(lang.languageIso)
              : lang.languageIso
            languageSet.add(languageCode)
          }
        })
      }
    })

    const dynamicGroups = buildDynamicConsolidationGroups(Array.from(rawLanguageCodes))
    const consolidatedByKey = {
      ...predefinedConsolidatedByKey,
      ...dynamicGroups,
    }

    if (consolidatedLanguageView) {
      const rebuiltLanguageSet = new Set()
      rawLanguageCodes.forEach((rawCode) => {
        const predefinedKey = getConsolidatedLanguageKey(rawCode)
        if (predefinedConsolidatedByKey[predefinedKey]) {
          rebuiltLanguageSet.add(predefinedKey)
          return
        }

        const { language, script, region } = parseLanguageCodeParts(rawCode)
        const fallbackRegion = region ?? DEFAULT_REGION_BY_LANGUAGE[language] ?? 'ZZ'
        const dynamicKey = script
          ? `${language}-${script}-${fallbackRegion}`
          : `${language}-${fallbackRegion}`
        rebuiltLanguageSet.add(dynamicKey)
      })
      languageSet.clear()
      rebuiltLanguageSet.forEach((item) => languageSet.add(item))
    }

    const distinctLanguages = languageSet.size

    const languageOptions = Array.from(languageSet).sort((a, b) =>
      getLanguageDisplayLabel(a, consolidatedLanguageView, consolidatedByKey).localeCompare(
        getLanguageDisplayLabel(b, consolidatedLanguageView, consolidatedByKey),
      ),
    )

    const normalizedSearch = search.trim().toLowerCase()

    const filteredSnapshots = baseSnapshots.filter((snap) => {
      if (selectedProducts.length > 0) {
        const projectProducts = projectNameToProductKeys.get(snap.projectName) ?? []
        const isUnassigned = projectProducts.length === 0
        const wantsUnassigned = selectedProducts.includes('__unassigned__')
        const otherSelected = selectedProducts.filter((k) => k !== '__unassigned__')
        const matchesProduct = otherSelected.some((k) => projectProducts.includes(k))
        if (!matchesProduct && !(wantsUnassigned && isUnassigned)) return false
      }

      if (selectedLanguages.length > 0 && selectedProducts.length === 0) {
        const projectLangCodes = Array.isArray(snap.languages)
          ? snap.languages
              .map((lang) => {
                if (!lang?.languageIso) return null
                if (!consolidatedLanguageView) return lang.languageIso

                return resolveConsolidatedGroupKey(lang.languageIso)
              })
              .filter(Boolean)
          : []

        const hasSelectedLanguage = projectLangCodes.some((code) =>
          selectedLanguages.includes(code),
        )

        if (!hasSelectedLanguage) {
          return false
        }
      }

      if (!normalizedSearch) return true

      const haystack = [
        snap.projectName ?? '',
        snap.projectType ?? '',
        snap.projectId ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedSearch)
    })

    const coverageByLanguage = new Map()
    baseSnapshots.forEach((snap) => {
      const baseWords = Number(snap.baseWords)
      if (!Number.isFinite(baseWords) || baseWords <= 0) {
        return
      }

      const bestProgressByGroup = new Map()
      if (Array.isArray(snap.languages)) {
        snap.languages.forEach((lang) => {
          if (!lang?.languageIso) return
          const groupKey = resolveConsolidatedGroupKey(lang.languageIso)
          const progress = Number(lang.progress)
          if (!Number.isFinite(progress)) return
          const current = bestProgressByGroup.get(groupKey)
          if (current == null || progress > current) {
            bestProgressByGroup.set(groupKey, progress)
          }
        })
      }

      bestProgressByGroup.forEach((progress, groupKey) => {
        const metric = coverageByLanguage.get(groupKey) ?? {
          groupKey,
          projectsWithLanguage: 0,
          totalProjects: baseSnapshots.length,
          totalBaseWords: 0,
          translatedBaseWords: 0,
        }
        metric.projectsWithLanguage += 1
        metric.totalBaseWords += baseWords
        metric.translatedBaseWords += baseWords * (progress / 100)
        coverageByLanguage.set(groupKey, metric)
      })
    })

    const languageCoverageRows = Array.from(coverageByLanguage.values()).map((metric) => {
      const coveragePct =
        metric.totalBaseWords > 0
          ? (metric.translatedBaseWords / metric.totalBaseWords) * 100
          : null
      return {
        ...metric,
        coveragePct,
        displayLabel: getLanguageDisplayLabel(metric.groupKey, true, consolidatedByKey),
      }
    })

    const languagesAboveNinetyPct = languageCoverageRows.filter(
      (row) => row.coveragePct != null && row.coveragePct >= 90,
    ).length
    const totalConsolidatedLanguages = languageCoverageRows.length
    const totalTranslated = languageCoverageRows.reduce(
      (acc, row) => acc + row.translatedBaseWords,
      0,
    )
    const totalBaseWordsCovered = languageCoverageRows.reduce(
      (acc, row) => acc + row.totalBaseWords,
      0,
    )
    const overallWeightedCoveragePct =
      totalBaseWordsCovered > 0 ? (totalTranslated / totalBaseWordsCovered) * 100 : null

    return {
      kpis: {
        totalProjects,
        averageProgress,
        totalBaseWords,
        distinctLanguages,
      },
      filteredSnapshots,
      languageOptions,
      consolidatedByKey,
      languageCoverageRows,
      languagesAboveNinetyPct,
      totalConsolidatedLanguages,
      overallWeightedCoveragePct,
    }
  }, [snapshots, search, selectedProducts, selectedLanguages, consolidatedLanguageView])

  const effectiveLanguages = selectedLanguages.length > 0 ? selectedLanguages : languageOptions
  const sortedLanguageCoverageRows = useMemo(() => {
    const rows = [...languageCoverageRows]
    if (languageAnalyticsSort === 'projects-desc') {
      rows.sort((a, b) => b.projectsWithLanguage - a.projectsWithLanguage)
      return rows
    }
    rows.sort((a, b) => (b.coveragePct ?? -1) - (a.coveragePct ?? -1))
    return rows
  }, [languageCoverageRows, languageAnalyticsSort])

  const handleTableResizeStart = (event) => {
    event.preventDefault()
    resizeStartYRef.current = event.clientY
    resizeStartHeightRef.current = tableHeight

    const minHeight = 320
    const maxHeight = Math.max(420, Math.floor(window.innerHeight * 0.75))

    const handleMouseMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - resizeStartYRef.current
      const nextHeight = Math.min(
        maxHeight,
        Math.max(minHeight, resizeStartHeightRef.current + deltaY),
      )
      setTableHeight(nextHeight)
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleCoverageResizeStart = (event) => {
    event.preventDefault()
    coverageResizeStartYRef.current = event.clientY
    coverageResizeStartHeightRef.current = coverageHeight

    const minHeight = 200
    const maxHeight = Math.max(300, Math.floor(window.innerHeight * 0.75))

    const handleMouseMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - coverageResizeStartYRef.current
      const nextHeight = Math.min(
        maxHeight,
        Math.max(minHeight, coverageResizeStartHeightRef.current + deltaY),
      )
      setCoverageHeight(nextHeight)
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  if (!latestUpload) {
    return (
      <section className="mt-8">
        <p className="text-xs text-slate-500">No snapshot data available.</p>
      </section>
    )
  }

  return (
    <section className="mt-8 space-y-6">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-slate-900">
          Latest snapshot
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Data as of <span className="font-medium text-slate-700">{formatShortDate(latestUpload.importedAt)}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-slate-500">
            Projects in snapshot
          </p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {formatNumber(kpis.totalProjects)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Active Lokalise projects included in the most recent export.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-slate-500">
            Average overall progress
          </p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {formatPercent(kpis.averageProgress)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Mean of <span className="font-medium">statistics.progress_total</span> across
            all projects.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-slate-500">
            Base words
          </p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {formatNumber(kpis.totalBaseWords)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Total source-language words across all projects in this snapshot.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-slate-500">
            Languages in use
          </p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {formatNumber(kpis.distinctLanguages)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Unique language codes found in project statistics.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">

          {/* Filter header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-xs font-semibold tracking-tight text-slate-900">
              Projects in latest snapshot
            </h3>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name…"
              className="w-48 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Product filter */}
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Product
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRODUCT_GROUPS.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  onClick={() =>
                    setSelectedProducts((prev) =>
                      prev.includes(group.key)
                        ? prev.filter((k) => k !== group.key)
                        : [...prev, group.key],
                    )
                  }
                  className={[
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    selectedProducts.includes(group.key)
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400 hover:text-slate-900',
                  ].join(' ')}
                >
                  {group.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  setSelectedProducts((prev) =>
                    prev.includes('__unassigned__')
                      ? prev.filter((k) => k !== '__unassigned__')
                      : [...prev, '__unassigned__'],
                  )
                }
                className={[
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  selectedProducts.includes('__unassigned__')
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-400 hover:text-slate-700',
                ].join(' ')}
              >
                Unassigned
              </button>
              {selectedProducts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedProducts([])}
                  className="rounded-full border border-transparent px-3 py-1 text-xs font-medium text-slate-400 hover:text-slate-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Language filter */}
          {languageOptions.length > 0 && (
            <div className="px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Target language
                </p>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-500">
                  <input
                    type="checkbox"
                    checked={!consolidatedLanguageView}
                    onChange={(event) => {
                      setConsolidatedLanguageView(!event.target.checked)
                      setSelectedLanguages([])
                    }}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900/10"
                  />
                  Show individual codes
                </label>
              </div>
              <div className="columns-2 gap-x-4 lg:columns-3 xl:columns-4">
                {(() => {
                  let prevLetter = null
                  return languageOptions.map((code) => {
                    const label = getLanguageDisplayLabel(code, consolidatedLanguageView, consolidatedByKey)
                    const letter = label[0].toUpperCase()
                    const isFirst = letter !== prevLetter
                    prevLetter = letter
                    return (
                      <label key={code} className="mb-1.5 flex break-inside-avoid cursor-pointer items-center gap-1">
                        <span className="w-3.5 flex-shrink-0 text-[0.6rem] font-bold leading-none text-slate-400">
                          {isFirst ? letter : ''}
                        </span>
                        <input
                          type="checkbox"
                          checked={selectedLanguages.includes(code)}
                          onChange={() =>
                            setSelectedLanguages((prev) =>
                              prev.includes(code)
                                ? prev.filter((c) => c !== code)
                                : [...prev, code],
                            )
                          }
                          className="h-3.5 w-3.5 flex-shrink-0 rounded border-slate-300 accent-slate-900"
                        />
                        <span className="truncate text-xs text-slate-700">{label}</span>
                      </label>
                    )
                  })
                })()}
              </div>
              {selectedLanguages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedLanguages([])}
                  className="mt-2 text-[0.7rem] font-medium text-slate-400 hover:text-slate-700"
                >
                  Clear selection
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <span className="text-lg">⚠️</span>
          <p className="text-sm font-semibold text-amber-900">
            Progress percentages reflect translation existence only, not quality.
          </p>
        </div>

        <div
          className="relative overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm"
          style={{ height: `${tableHeight}px` }}
        >
          <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-40 bg-slate-50">
              <tr>
                <th className="sticky top-0 left-0 bg-slate-50 border-b border-r border-slate-200 px-4 py-3 font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap min-w-[250px]">Project</th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold uppercase tracking-wider text-slate-500 text-right">Keys</th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold uppercase tracking-wider text-slate-500 text-right">Base words</th>
                {effectiveLanguages.map((code) => (
                  <th key={code} className="border-b border-slate-200 px-4 py-3 font-bold tracking-wider text-slate-500 text-center min-w-[180px]">
                    {getLanguageDisplayLabel(code, consolidatedLanguageView, consolidatedByKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSnapshots.length === 0 ? (
                <tr>
                  <td colSpan={3 + effectiveLanguages.length} className="px-4 py-10 text-center text-slate-500">
                    No projects match the current filters.
                  </td>
                </tr>
              ) : (
                filteredSnapshots.map((snap) => (
                  <tr key={`${snap.uploadId}-${snap.projectId}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="sticky left-0 z-20 bg-white border-r border-slate-100 px-4 py-3 font-medium text-slate-900 whitespace-nowrap min-w-[250px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                      {snap.projectName || 'Untitled project'}
                    </td>
                    <td className="px-4 py-3 font-mono text-right text-slate-600">
                      {formatNumber(snap.keysTotal)}
                    </td>
                    <td className="px-4 py-3 font-mono text-right text-slate-600">
                      {formatNumber(snap.baseWords)}
                    </td>
                    {effectiveLanguages.map((code) => {
                      const matchingLangs = Array.isArray(snap.languages)
                        ? snap.languages.filter((lang) => {
                            if (!lang?.languageIso) return false
                            let comparableCode = lang.languageIso
                            if (consolidatedLanguageView) {
                                comparableCode = resolveConsolidatedGroupKey(lang.languageIso)
                            }
                            return comparableCode === code
                          })
                        : []
                      const progressValues = matchingLangs
                        .map((lang) => lang?.progress)
                        .filter((value) => typeof value === 'number')
                      const pct = progressValues.length > 0
                        ? Math.round(
                            progressValues.reduce((acc, value) => acc + value, 0) /
                              progressValues.length,
                          )
                        : null
                      return (
                        <td key={code} className={`px-4 py-3 text-center font-mono border-x border-white/20 ${getProgressBgColor(pct)}`}>
                          {pct != null ? `${pct}%` : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onMouseDown={handleTableResizeStart}
            className="group flex h-4 w-full cursor-row-resize items-center justify-center"
            aria-label="Resize project table height"
            title="Drag to resize table height"
          >
            <span className="h-1.5 w-16 rounded-full bg-slate-300 transition-colors group-hover:bg-slate-500" />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 p-5 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xs font-semibold tracking-tight text-slate-900">
              Coverage analytics
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Consolidated-language coverage weighted by base words (latest snapshot).
            </p>
          </div>
        </div>

        <div
          className="overflow-auto px-5"
          style={{ height: `${coverageHeight}px` }}
        >
          <div className="grid gap-4 pb-1 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Languages above 90% coverage
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatNumber(languagesAboveNinetyPct)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                out of {formatNumber(totalConsolidatedLanguages)} consolidated languages
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Overall weighted coverage
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatPercent(overallWeightedCoveragePct)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                weighted by base words across project-language pairs
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Consolidated languages with data
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatNumber(totalConsolidatedLanguages)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                languages found in current snapshot
              </p>
            </div>
          </div>

          <div className="mt-5 pb-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold tracking-tight text-slate-900">
                Per consolidated language
              </h4>
              <select
                value={languageAnalyticsSort}
                onChange={(event) => setLanguageAnalyticsSort(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/5"
              >
                <option value="coverage-desc">Sort by coverage (high to low)</option>
                <option value="projects-desc">Sort by projects with language</option>
              </select>
            </div>

            <div className="overflow-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-slate-500">
                      Language
                    </th>
                    <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-slate-500 text-right">
                      Projects with language
                    </th>
                    <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-slate-500 text-right">
                      Weighted coverage
                    </th>
                    <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-slate-500 text-right">
                      Translated / total base words
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {sortedLanguageCoverageRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                        No language coverage data available.
                      </td>
                    </tr>
                  ) : (
                    sortedLanguageCoverageRows.map((row) => (
                      <tr key={row.groupKey}>
                        <td className="px-3 py-2.5 text-slate-900">{row.displayLabel}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                          {formatNumber(row.projectsWithLanguage)}/{formatNumber(row.totalProjects)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                          {formatPercent(row.coveragePct)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                          {formatNumber(Math.round(row.translatedBaseWords))}/{formatNumber(Math.round(row.totalBaseWords))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex justify-center py-1">
          <button
            type="button"
            onMouseDown={handleCoverageResizeStart}
            className="group flex h-4 w-full cursor-row-resize items-center justify-center"
            aria-label="Resize coverage analytics height"
            title="Drag to resize coverage analytics height"
          >
            <span className="h-1.5 w-16 rounded-full bg-slate-300 transition-colors group-hover:bg-slate-500" />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h3 className="text-xs font-semibold tracking-tight text-slate-900">
            Progress over time
          </h3>
          <p className="text-sm text-slate-600">
            Trend across all imported snapshots for total base words and languages in
            use, project count, and average progress.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { key: 'totalBaseWords', label: 'Base words' },
            { key: 'distinctLanguages', label: 'Languages in use' },
            { key: 'totalProjects', label: 'Number of projects' },
            { key: 'averageProgress', label: 'Average overall progress' },
          ].map((series) => (
            <button
              key={series.key}
              type="button"
              onClick={() =>
                setVisibleSeries((prev) => ({
                  ...prev,
                  [series.key]: !prev[series.key],
                }))
              }
              className={[
                'rounded-full border px-2.5 py-1 text-[0.7rem] font-medium transition-colors',
                visibleSeries[series.key]
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-500 hover:text-slate-700',
              ].join(' ')}
              aria-pressed={visibleSeries[series.key]}
            >
              {series.label}
            </button>
          ))}
        </div>

        {historySeries.length > 0 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {visibleSeries.totalBaseWords && (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
                  Base words
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  Total source-language words across all projects in each upload.
                </p>
                <div className="mt-3 h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historySeries} margin={{ top: 6, right: 10, left: 0, bottom: 6 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value)} />
                      <Tooltip
                        formatter={(value) => [formatNumber(value), 'Base words']}
                        labelFormatter={(_, payload) => {
                          const item = payload?.[0]?.payload
                          return item?.importedAt ? `Imported ${formatDateTime(item.importedAt)}` : 'Import'
                        }}
                      />
                      <Line type="monotone" dataKey="totalBaseWords" stroke="#0f172a" strokeWidth={2.2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {visibleSeries.distinctLanguages && (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
                  Languages in use
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  Count of unique target language codes present per upload.
                </p>
                <div className="mt-3 h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historySeries} margin={{ top: 6, right: 10, left: 0, bottom: 6 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(value) => [value, 'Languages in use']}
                        labelFormatter={(_, payload) => {
                          const item = payload?.[0]?.payload
                          return item?.importedAt ? `Imported ${formatDateTime(item.importedAt)}` : 'Import'
                        }}
                      />
                      <Line type="monotone" dataKey="distinctLanguages" stroke="#0ea5e9" strokeWidth={2.2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {visibleSeries.totalProjects && (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
                  Number of projects
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  Number of projects included in each imported snapshot.
                </p>
                <div className="mt-3 h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historySeries} margin={{ top: 6, right: 10, left: 0, bottom: 6 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(value) => [value, 'Number of projects']}
                        labelFormatter={(_, payload) => {
                          const item = payload?.[0]?.payload
                          return item?.importedAt ? `Imported ${formatDateTime(item.importedAt)}` : 'Import'
                        }}
                      />
                      <Line type="monotone" dataKey="totalProjects" stroke="#8b5cf6" strokeWidth={2.2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {visibleSeries.averageProgress && (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
                  Average overall progress
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  Mean project progress percentage from `statistics.progress_total`.
                </p>
                <div className="mt-3 h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historySeries} margin={{ top: 6, right: 10, left: 0, bottom: 6 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                      <Tooltip
                        formatter={(value) => [formatPercent(value), 'Average overall progress']}
                        labelFormatter={(_, payload) => {
                          const item = payload?.[0]?.payload
                          return item?.importedAt ? `Imported ${formatDateTime(item.importedAt)}` : 'Import'
                        }}
                      />
                      <Line type="monotone" dataKey="averageProgress" stroke="#f97316" strokeWidth={2.2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Import at least one snapshot to populate the chart.
          </p>
        )}
      </div>
    </section>
  )
}

