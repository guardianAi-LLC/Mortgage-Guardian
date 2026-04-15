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

interface CaseFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: string
  onStatusChange: (value: string) => void
  dateFrom: string
  onDateFromChange: (value: string) => void
  dateTo: string
  onDateToChange: (value: string) => void
  sortBy: string
  onSortChange: (value: string) => void
}

export function CaseFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  sortBy,
  onSortChange,
}: CaseFiltersProps) {
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
          placeholder="Search cases..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-8 border-gray-700 bg-gray-950 text-gray-300 placeholder:text-gray-500"
        />
      </div>

      <Select value={statusFilter} onValueChange={(v) => v && onStatusChange(v)}>
        <SelectTrigger className="w-[160px] border-gray-700 bg-gray-950 text-gray-300">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="in_review">In Review</SelectItem>
          <SelectItem value="complete">Complete</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
        </SelectContent>
      </Select>

      <Input
        type="date"
        value={dateFrom}
        onChange={(e) => onDateFromChange(e.target.value)}
        className="w-[160px] border-gray-700 bg-gray-950 text-gray-300"
        placeholder="From"
      />

      <Input
        type="date"
        value={dateTo}
        onChange={(e) => onDateToChange(e.target.value)}
        className="w-[160px] border-gray-700 bg-gray-950 text-gray-300"
        placeholder="To"
      />

      <Select value={sortBy} onValueChange={(v) => v && onSortChange(v)}>
        <SelectTrigger className="w-[160px] border-gray-700 bg-gray-950 text-gray-300">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest First</SelectItem>
          <SelectItem value="oldest">Oldest First</SelectItem>
          <SelectItem value="name_asc">Name A-Z</SelectItem>
          <SelectItem value="name_desc">Name Z-A</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
