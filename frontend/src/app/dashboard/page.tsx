'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { FolderOpen, FileText, AlertTriangle, Briefcase, Plus } from 'lucide-react'
import { useCases } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/page-header'
import { StatsCard } from '@/components/stats-card'
import { CaseTable } from '@/components/case-table'
import { CaseFilters } from '@/components/case-filters'
import { EmptyState } from '@/components/empty-state'

const PAGE_SIZE = 20

export default function DashboardPage() {
  const { data: cases, isLoading } = useCases()

  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('newest')

  const resetPage = useCallback(() => setPage(0), [])
  const handleSearchChange = useCallback((v: string) => { setSearch(v); resetPage() }, [resetPage])
  const handleStatusChange = useCallback((v: string) => { setStatusFilter(v); resetPage() }, [resetPage])
  const handleDateFromChange = useCallback((v: string) => { setDateFrom(v); resetPage() }, [resetPage])
  const handleDateToChange = useCallback((v: string) => { setDateTo(v); resetPage() }, [resetPage])
  const handleSortChange = useCallback((v: string) => { setSortBy(v); resetPage() }, [resetPage])

  // Stats use raw (unfiltered) cases
  const totalCases = cases?.length ?? 0
  const activeCases = cases?.filter((c) => c.status === 'open' || c.status === 'in_review').length ?? 0
  const totalDocuments = cases?.reduce((sum, c) => sum + (c.documents?.length ?? 0), 0) ?? 0
  const totalAnomalies = cases?.reduce((sum, c) => {
    return sum + (c.documents?.reduce((dSum, d) => dSum + (d.analysis_report?.anomalies?.length ?? 0), 0) ?? 0)
  }, 0) ?? 0

  const allCases = cases ?? []

  const filteredCases = useMemo(() => {
    let result = allCases

    if (search) {
      const lower = search.toLowerCase()
      result = result.filter((c) =>
        c.caseName.toLowerCase().includes(lower) ||
        (c.borrowerName?.toLowerCase().includes(lower) ?? false) ||
        (c.servicerName?.toLowerCase().includes(lower) ?? false) ||
        (c.loanNumber?.toLowerCase().includes(lower) ?? false)
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter)
    }

    if (dateFrom) {
      const from = new Date(dateFrom)
      result = result.filter((c) => new Date(c.created_at) >= from)
    }

    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      result = result.filter((c) => new Date(c.created_at) <= to)
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'name_asc':
          return a.caseName.localeCompare(b.caseName)
        case 'name_desc':
          return b.caseName.localeCompare(a.caseName)
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    return result
  }, [allCases, search, statusFilter, dateFrom, dateTo, sortBy])

  const totalFiltered = filteredCases.length
  const isFiltered = search || statusFilter !== 'all' || dateFrom || dateTo
  const paginatedCases = filteredCases.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const start = page * PAGE_SIZE + 1
  const end = Math.min((page + 1) * PAGE_SIZE, totalFiltered)
  const hasPrev = page > 0
  const hasNext = end < totalFiltered

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your mortgage audit cases"
      />

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))
        ) : (
          <>
            <StatsCard label="Total Cases" value={totalCases} icon={Briefcase} />
            <StatsCard label="Active Cases" value={activeCases} icon={FolderOpen} />
            <StatsCard label="Documents" value={totalDocuments} icon={FileText} />
            <StatsCard label="Findings" value={totalAnomalies} icon={AlertTriangle} />
          </>
        )}
      </div>

      {/* Cases section */}
      <PageHeader title="Cases">
        <Link href="/dashboard/cases/new">
          <Button className="bg-[#2997FF] text-white hover:bg-[#2080E0]">
            <Plus className="h-4 w-4" />
            New Case
          </Button>
        </Link>
      </PageHeader>

      <CaseFilters
        search={search}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusChange={handleStatusChange}
        dateFrom={dateFrom}
        onDateFromChange={handleDateFromChange}
        dateTo={dateTo}
        onDateToChange={handleDateToChange}
        sortBy={sortBy}
        onSortChange={handleSortChange}
      />

      {isLoading ? (
        <CaseTable cases={[]} isLoading />
      ) : allCases.length > 0 ? (
        paginatedCases.length > 0 ? (
          <>
            <CaseTable cases={paginatedCases} isLoading={false} />

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mt-4 px-2">
              <p className="text-sm text-gray-400">
                {isFiltered
                  ? `Showing ${totalFiltered} of ${totalCases} cases`
                  : `Showing ${start}–${end} of ${totalCases}`}
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
        ) : (
          <EmptyState
            icon={FolderOpen}
            title="No cases match your filters"
            description="Try adjusting your search or filter criteria."
          >
            <Button
              variant="outline"
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
                setDateFrom('')
                setDateTo('')
                setSortBy('newest')
                setPage(0)
              }}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Clear filters
            </Button>
          </EmptyState>
        )
      ) : (
        <EmptyState
          icon={FolderOpen}
          title="No cases yet"
          description="Create your first case to begin analyzing mortgage documents for servicer violations."
        >
          <Link href="/dashboard/cases/new">
            <Button className="bg-[#2997FF] text-white hover:bg-[#2080E0]">
              <Plus className="h-4 w-4" />
              Create Your First Case
            </Button>
          </Link>
        </EmptyState>
      )}
    </div>
  )
}
