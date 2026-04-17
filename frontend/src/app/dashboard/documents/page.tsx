'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { FileText, AlertTriangle } from 'lucide-react'
import { useDocuments, useDeleteDocument, useRetryDocument } from '@/lib/hooks'
import { useDocumentNotifications } from '@/hooks/use-document-notifications'
import { DocumentFilters } from '@/components/document-filters'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { RiskBadge } from '@/components/risk-badge'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { formatRelativeTime } from '@/lib/utils'

const PAGE_SIZE = 20

function anomalyLevel(count: number): 'critical' | 'high' | 'medium' | 'low' | 'clean' {
  if (count === 0) return 'clean'
  if (count <= 2) return 'low'
  if (count <= 5) return 'medium'
  if (count <= 10) return 'high'
  return 'critical'
}

function statusBadge(status?: string) {
  switch (status) {
    case 'complete':
    case 'analyzed':
      return <RiskBadge level="clean" label="Complete" />
    case 'failed':
      return <RiskBadge level="critical" label="Failed" />
    case 'uploaded':
    case 'ocr':
    case 'classifying':
    case 'analyzing':
      return <RiskBadge level="info" label={capitalize(status)} />
    default:
      return <RiskBadge level="info" label="Pending" />
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-4" /></TableCell>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
          <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-12" /></TableCell>
          <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

export default function DocumentsPage() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [batchStatus, setBatchStatus] = useState('')
  const batchStatusTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const deleteDoc = useDeleteDocument()
  const retryDoc = useRetryDocument()

  const { data, isLoading, isError, refetch } = useDocuments({ limit: 500, offset: 0 })

  const allDocuments = data?.documents ?? []
  useDocumentNotifications(allDocuments)

  const resetPage = useCallback(() => setPage(0), [])
  const handleSearchChange = useCallback((v: string) => { setSearch(v); resetPage() }, [resetPage])
  const handleTypeChange = useCallback((v: string) => { setTypeFilter(v); resetPage() }, [resetPage])
  const handleStatusChange = useCallback((v: string) => { setStatusFilter(v); resetPage() }, [resetPage])
  const handleSortChange = useCallback((v: string) => { setSortBy(v); resetPage() }, [resetPage])
  const handleDateFromChange = useCallback((v: string) => { setDateFrom(v); resetPage() }, [resetPage])
  const handleDateToChange = useCallback((v: string) => { setDateTo(v); resetPage() }, [resetPage])
  const handleSeverityChange = useCallback((v: string) => { setSeverityFilter(v); resetPage() }, [resetPage])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [search, typeFilter, statusFilter, sortBy, dateFrom, dateTo, severityFilter])

  const filteredDocuments = useMemo(() => {
    let docs = allDocuments

    if (search) {
      const lower = search.toLowerCase()
      docs = docs.filter((doc) => doc.file_name.toLowerCase().includes(lower))
    }

    if (typeFilter !== 'all') {
      docs = docs.filter((doc) => doc.document_type === typeFilter)
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'processing') {
        docs = docs.filter((doc) =>
          doc.pipeline_status === 'ocr' ||
          doc.pipeline_status === 'classifying' ||
          doc.pipeline_status === 'analyzing'
        )
      } else {
        docs = docs.filter((doc) => doc.pipeline_status === statusFilter)
      }
    }

    if (dateFrom) {
      docs = docs.filter((doc) => doc.created_at >= dateFrom)
    }
    if (dateTo) {
      docs = docs.filter((doc) => doc.created_at.slice(0, 10) <= dateTo)
    }

    if (severityFilter !== 'all') {
      docs = docs.filter((doc) => {
        const anomalies = doc.analysis_report?.anomalies ?? []
        const count = anomalies.length
        switch (severityFilter) {
          case 'has_findings': return count > 0
          case 'critical': return anomalies.some((a) => a.severity === 'critical')
          case 'high': return anomalies.some((a) => a.severity === 'critical' || a.severity === 'high')
          case 'clean': return count === 0
          default: return true
        }
      })
    }

    docs = [...docs].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'name_asc':
          return a.file_name.localeCompare(b.file_name)
        case 'name_desc':
          return b.file_name.localeCompare(a.file_name)
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    return docs
  }, [allDocuments, search, typeFilter, statusFilter, sortBy, dateFrom, dateTo, severityFilter])

  const totalRaw = allDocuments.length
  const totalFiltered = filteredDocuments.length
  const isFiltered = search || typeFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo || severityFilter !== 'all'
  const documents = filteredDocuments.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const start = page * PAGE_SIZE + 1
  const end = Math.min((page + 1) * PAGE_SIZE, totalFiltered)
  const hasPrev = page > 0
  const hasNext = end < totalFiltered

  const toggleOne = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const toggleAll = () => {
    const pageIds = documents.map(d => d.document_id)
    const allSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id))
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        pageIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelectedIds(prev => new Set([...prev, ...pageIds]))
    }
  }

  const pageAllSelected = documents.length > 0 && documents.every(d => selectedIds.has(d.document_id))
  const pageSomeSelected = documents.some(d => selectedIds.has(d.document_id)) && !pageAllSelected

  const clearBatchStatusAfterDelay = useCallback(() => {
    if (batchStatusTimer.current) clearTimeout(batchStatusTimer.current)
    batchStatusTimer.current = setTimeout(() => setBatchStatus(''), 3000)
  }, [])

  const handleBatchDelete = useCallback(async () => {
    const ids = Array.from(selectedIds)
    const total = ids.length
    let successes = 0
    let failures = 0
    const failedIds: string[] = []

    setShowDeleteDialog(false)

    for (let i = 0; i < ids.length; i++) {
      setBatchStatus(`Deleting ${i + 1} of ${total}...`)
      try {
        await deleteDoc.mutateAsync(ids[i])
        successes++
      } catch {
        failures++
        failedIds.push(ids[i])
      }
    }

    if (failures > 0) {
      setSelectedIds(new Set(failedIds))
      setBatchStatus(`${successes} deleted, ${failures} failed`)
    } else {
      setSelectedIds(new Set())
      setBatchStatus(`${successes} deleted successfully`)
    }
    clearBatchStatusAfterDelay()
  }, [selectedIds, deleteDoc, clearBatchStatusAfterDelay])

  const handleBatchReanalyze = useCallback(async () => {
    const ids = Array.from(selectedIds)
    const total = ids.length
    let successes = 0
    let failures = 0
    const failedIds: string[] = []

    for (let i = 0; i < ids.length; i++) {
      setBatchStatus(`Re-analyzing ${i + 1} of ${total}...`)
      try {
        await retryDoc.mutateAsync(ids[i])
        successes++
      } catch {
        failures++
        failedIds.push(ids[i])
      }
    }

    if (failures > 0) {
      setSelectedIds(new Set(failedIds))
      setBatchStatus(`${successes} queued, ${failures} failed`)
    } else {
      setSelectedIds(new Set())
      setBatchStatus(`${successes} queued for re-analysis`)
    }
    clearBatchStatusAfterDelay()
  }, [selectedIds, retryDoc, clearBatchStatusAfterDelay])

  return (
    <div>
      <div className="flex items-center gap-3">
        <PageHeader
          title="Documents"
          description="All uploaded mortgage documents across your cases"
        />
        {selectedIds.size > 0 && (
          <span className="ml-auto shrink-0 rounded-md bg-blue-900/60 px-2.5 py-1 text-xs font-medium text-blue-300">
            {selectedIds.size} selected
          </span>
        )}
      </div>

      <DocumentFilters
        search={search}
        onSearchChange={handleSearchChange}
        typeFilter={typeFilter}
        onTypeChange={handleTypeChange}
        statusFilter={statusFilter}
        onStatusChange={handleStatusChange}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        dateFrom={dateFrom}
        onDateFromChange={handleDateFromChange}
        dateTo={dateTo}
        onDateToChange={handleDateToChange}
        severityFilter={severityFilter}
        onSeverityChange={handleSeverityChange}
      />

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-blue-950/50 border border-blue-800 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-3 text-sm text-blue-200">
            <span>{selectedIds.size} document(s) selected</span>
            {batchStatus && (
              <span className="text-blue-400">{batchStatus}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-gray-300 hover:text-white"
            >
              Clear
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchReanalyze}
              disabled={!!batchStatus}
              className="border-gray-600 text-gray-200 hover:bg-gray-800"
            >
              Re-analyze
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={!!batchStatus}
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} Document(s)</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The selected documents and their analysis results will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button variant="destructive" onClick={handleBatchDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="overflow-x-auto" aria-busy={true}>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-transparent">
                <TableHead className="w-10"><Skeleton className="h-4 w-4" /></TableHead>
                <TableHead className="text-gray-400">File Name</TableHead>
                <TableHead className="text-gray-400 hidden sm:table-cell">Type</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400 hidden md:table-cell">Anomalies</TableHead>
                <TableHead className="text-gray-400 hidden lg:table-cell">Date Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <LoadingRows />
            </TableBody>
          </Table>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-red-900/30 p-4">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-1">Failed to load documents</h3>
          <p className="text-sm text-gray-400 max-w-sm mb-6">
            Something went wrong while fetching your documents. Please try again.
          </p>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            Retry
          </Button>
        </div>
      ) : totalRaw === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Upload documents to a case to start analysis."
        >
          <Link href="/dashboard">
            <Button className="bg-[#2997FF] text-white hover:bg-[#2080E0]">
              Go to Dashboard
            </Button>
          </Link>
        </EmptyState>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents match your filters"
          description="Try adjusting your search or filter criteria."
        >
          <Button
            variant="outline"
            onClick={() => {
              setSearch('')
              setTypeFilter('all')
              setStatusFilter('all')
              setSortBy('newest')
              setDateFrom('')
              setDateTo('')
              setSeverityFilter('all')
              setPage(0)
            }}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            Clear filters
          </Button>
        </EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto" aria-busy={false}>
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={pageAllSelected}
                      ref={(el) => { if (el) el.indeterminate = pageSomeSelected }}
                      onChange={toggleAll}
                      className="accent-blue-500 h-4 w-4 rounded border-gray-600 bg-gray-800"
                    />
                  </TableHead>
                  <TableHead className="text-gray-400">File Name</TableHead>
                  <TableHead className="text-gray-400 hidden sm:table-cell">Type</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400 hidden md:table-cell">Anomalies</TableHead>
                  <TableHead className="text-gray-400 hidden lg:table-cell">Date Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const anomalyCount = doc.analysis_report?.anomalies?.length ?? 0
                  return (
                    <TableRow
                      key={doc.document_id}
                      className="cursor-pointer border-gray-800 hover:bg-gray-800/50"
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(doc.document_id)}
                          onChange={() => toggleOne(doc.document_id)}
                          className="accent-blue-500 h-4 w-4 rounded border-gray-600 bg-gray-800"
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/dashboard/documents/${doc.document_id}`}
                          className="font-medium text-white hover:text-blue-400"
                        >
                          {doc.file_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-gray-300 capitalize hidden sm:table-cell">{doc.document_type}</TableCell>
                      <TableCell aria-live="polite">{statusBadge(doc.pipeline_status)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <RiskBadge
                          level={anomalyLevel(anomalyCount)}
                          label={`${anomalyCount} found`}
                        />
                      </TableCell>
                      <TableCell className="text-gray-400 hidden lg:table-cell">{formatRelativeTime(doc.created_at)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 px-2">
            <p className="text-sm text-gray-400">
              {isFiltered
                ? `Showing ${totalFiltered} of ${totalRaw} documents`
                : `Showing ${start}–${end} of ${totalRaw}`}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={!hasPrev}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasNext}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
