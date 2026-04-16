'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

interface DocumentFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  typeFilter: string
  onTypeChange: (value: string) => void
  statusFilter: string
  onStatusChange: (value: string) => void
  sortBy: string
  onSortChange: (value: string) => void
  dateFrom?: string
  onDateFromChange?: (value: string) => void
  dateTo?: string
  onDateToChange?: (value: string) => void
  severityFilter?: string
  onSeverityChange?: (value: string) => void
}

export function DocumentFilters({
  search,
  onSearchChange,
  typeFilter,
  onTypeChange,
  statusFilter,
  onStatusChange,
  sortBy,
  onSortChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  severityFilter,
  onSeverityChange,
}: DocumentFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search)

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [localSearch, onSearchChange])

  useEffect(() => {
    setLocalSearch(search)
  }, [search])

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
        <Input
          placeholder="Search documents..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-8 border-gray-700 bg-gray-950 text-gray-300 placeholder:text-gray-500"
        />
      </div>

      <Select value={typeFilter} onValueChange={(v) => v && onTypeChange(v)}>
        <SelectTrigger className="w-full sm:w-[160px] border-gray-700 bg-gray-950 text-gray-300">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="mortgage_statement">Mortgage Statement</SelectItem>
          <SelectItem value="bank_statement">Bank Statement</SelectItem>
          <SelectItem value="tax_document">Tax Document</SelectItem>
          <SelectItem value="correspondence">Correspondence</SelectItem>
          <SelectItem value="legal_document">Legal Document</SelectItem>
          <SelectItem value="unknown">Unknown</SelectItem>
        </SelectContent>
      </Select>

      <Select value={statusFilter} onValueChange={(v) => v && onStatusChange(v)}>
        <SelectTrigger className="w-full sm:w-[160px] border-gray-700 bg-gray-950 text-gray-300">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="uploaded">Uploaded</SelectItem>
          <SelectItem value="processing">Processing</SelectItem>
          <SelectItem value="analyzed">Analyzed</SelectItem>
          <SelectItem value="complete">Complete</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortBy} onValueChange={(v) => v && onSortChange(v)}>
        <SelectTrigger className="w-full sm:w-[160px] border-gray-700 bg-gray-950 text-gray-300">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest First</SelectItem>
          <SelectItem value="oldest">Oldest First</SelectItem>
          <SelectItem value="name_asc">Name A-Z</SelectItem>
          <SelectItem value="name_desc">Name Z-A</SelectItem>
        </SelectContent>
      </Select>

      {onDateFromChange && (
        <Input
          type="date"
          value={dateFrom ?? ''}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="w-full sm:w-[140px] border-gray-700 bg-gray-950 text-gray-300"
          placeholder="From"
        />
      )}

      {onDateToChange && (
        <Input
          type="date"
          value={dateTo ?? ''}
          onChange={(e) => onDateToChange(e.target.value)}
          className="w-full sm:w-[140px] border-gray-700 bg-gray-950 text-gray-300"
          placeholder="To"
        />
      )}

      {onSeverityChange && (
        <Select value={severityFilter ?? 'all'} onValueChange={(v) => v && onSeverityChange(v)}>
          <SelectTrigger className="w-full sm:w-[160px] border-gray-700 bg-gray-950 text-gray-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="has_findings">Has Findings</SelectItem>
            <SelectItem value="critical">Critical+</SelectItem>
            <SelectItem value="high">High+</SelectItem>
            <SelectItem value="clean">Clean Only</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
