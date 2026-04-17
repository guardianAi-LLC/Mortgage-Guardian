'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Search, Loader2 } from 'lucide-react'
import { useCases, useDocuments } from '@/lib/hooks'
import { Input } from '@/components/ui/input'
import { RiskBadge } from '@/components/risk-badge'

function statusToBadge(status: string): { level: 'critical' | 'high' | 'medium' | 'low' | 'clean' | 'info'; label: string } {
  switch (status) {
    case 'complete':
      return { level: 'clean', label: 'Complete' }
    case 'in_review':
      return { level: 'medium', label: 'In Review' }
    case 'archived':
      return { level: 'info', label: 'Archived' }
    case 'open':
      return { level: 'low', label: 'Open' }
    case 'failed':
      return { level: 'critical', label: 'Failed' }
    case 'uploaded':
    case 'ocr':
    case 'classifying':
    case 'analyzing':
    case 'analyzed':
    case 'review':
      return { level: 'info', label: status.charAt(0).toUpperCase() + status.slice(1) }
    default:
      return { level: 'info', label: status }
  }
}

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Click outside closes dropdown
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const { data: casesData, isLoading: casesLoading } = useCases()
  const { data: docsData, isLoading: docsLoading } = useDocuments({ limit: 500, offset: 0 })

  const isLoading = casesLoading || docsLoading

  const filteredCases = useMemo(() => {
    if (debouncedQuery.length < 2 || !casesData) return []
    const q = debouncedQuery.toLowerCase()
    return casesData
      .filter((c) =>
        c.caseName.toLowerCase().includes(q) ||
        c.borrowerName?.toLowerCase().includes(q) ||
        c.servicerName?.toLowerCase().includes(q) ||
        c.loanNumber?.toLowerCase().includes(q)
      )
      .slice(0, 5)
  }, [debouncedQuery, casesData])

  const filteredDocs = useMemo(() => {
    if (debouncedQuery.length < 2 || !docsData?.documents) return []
    const q = debouncedQuery.toLowerCase()
    return docsData.documents
      .filter((d) =>
        d.file_name.toLowerCase().includes(q) ||
        d.document_type.toLowerCase().includes(q)
      )
      .slice(0, 5)
  }, [debouncedQuery, docsData])

  const hasResults = filteredCases.length > 0 || filteredDocs.length > 0
  const totalResults = filteredCases.length + filteredDocs.length
  const showDropdown = open && debouncedQuery.length >= 2

  const statusMessage = useMemo(() => {
    if (debouncedQuery.length < 2) return ''
    if (isLoading) return 'Searching...'
    if (totalResults > 0) return `${totalResults} results found`
    return 'No results'
  }, [debouncedQuery, isLoading, totalResults])

  const closeDropdown = useCallback(() => setOpen(false), [])

  return (
    <div ref={containerRef} className="relative w-full max-w-[280px] sm:max-w-[400px]">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => { if (query.length >= 2) setOpen(true) }}
          placeholder="Search cases & documents... (\u2318K)"
          className="bg-gray-900/80 border border-gray-700 rounded-lg text-gray-300 pl-8 pr-3"
        />
        {isLoading && (
          <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-500" />
        )}
      </div>

      <span className="sr-only" aria-live="polite">{statusMessage}</span>

      {showDropdown && (
        <div className="absolute bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 max-h-[400px] overflow-y-auto mt-1 w-full" aria-live="polite" role="listbox">
          {!hasResults ? (
            <div className="px-3 py-4 text-sm text-gray-500" role="option" aria-selected={false}>
              No results for &apos;{debouncedQuery}&apos;
            </div>
          ) : (
            <>
              {filteredCases.length > 0 && (
                <div>
                  <div className="px-3 pt-2 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Cases
                  </div>
                  {filteredCases.map((c) => {
                    const badge = statusToBadge(c.status)
                    return (
                      <Link
                        key={c.id}
                        href={`/dashboard/cases/${c.id}`}
                        onClick={closeDropdown}
                        role="option"
                        aria-selected={false}
                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-800 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-200 truncate">{c.caseName}</div>
                          {c.borrowerName && (
                            <div className="text-xs text-gray-500 truncate">{c.borrowerName}</div>
                          )}
                        </div>
                        <RiskBadge level={badge.level} label={badge.label} className="ml-2 shrink-0" />
                      </Link>
                    )
                  })}
                </div>
              )}

              {filteredDocs.length > 0 && (
                <div>
                  {filteredCases.length > 0 && <div className="border-t border-gray-800" />}
                  <div className="px-3 pt-2 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Documents
                  </div>
                  {filteredDocs.map((d) => {
                    const badge = statusToBadge(d.pipeline_status ?? 'uploaded')
                    return (
                      <Link
                        key={d.document_id}
                        href={`/dashboard/documents/${d.document_id}`}
                        onClick={closeDropdown}
                        role="option"
                        aria-selected={false}
                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-800 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-200 truncate">{d.file_name}</div>
                          <div className="text-xs text-gray-500 truncate">{d.document_type}</div>
                        </div>
                        <RiskBadge level={badge.level} label={badge.label} className="ml-2 shrink-0" />
                      </Link>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
