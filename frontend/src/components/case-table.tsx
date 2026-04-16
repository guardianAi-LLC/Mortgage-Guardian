'use client'

import { useRouter } from 'next/navigation'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { RiskBadge } from '@/components/risk-badge'
import { formatRelativeTime } from '@/lib/utils'
import type { Case, CaseStatus } from '@/lib/types'

const statusConfig: Record<CaseStatus, { level: 'low' | 'medium' | 'clean' | 'info'; label: string }> = {
  open: { level: 'low', label: 'Open' },
  in_review: { level: 'medium', label: 'In Review' },
  complete: { level: 'clean', label: 'Complete' },
  archived: { level: 'info', label: 'Archived' },
}

interface CaseTableProps {
  cases: Case[]
  isLoading: boolean
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
          <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
          <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-8" /></TableCell>
          <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

export function CaseTable({ cases, isLoading }: CaseTableProps) {
  const router = useRouter()

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-800 hover:bg-transparent">
            <TableHead className="text-gray-400">Case Name</TableHead>
            <TableHead className="text-gray-400 hidden md:table-cell">Borrower</TableHead>
            <TableHead className="text-gray-400 hidden md:table-cell">Servicer</TableHead>
            <TableHead className="text-gray-400">Status</TableHead>
            <TableHead className="text-gray-400 hidden sm:table-cell">Documents</TableHead>
            <TableHead className="text-gray-400 hidden lg:table-cell">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <LoadingRows />
          ) : (
            cases.map((c) => {
              const config = statusConfig[c.status]
              return (
                <TableRow
                  key={c.id}
                  className="cursor-pointer border-gray-800 hover:bg-gray-800/50"
                  onClick={() => router.push(`/dashboard/cases/${c.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/dashboard/cases/${c.id}`) }}
                  tabIndex={0}
                  role="link"
                >
                  <TableCell className="font-medium text-white">{c.caseName}</TableCell>
                  <TableCell className="text-gray-300 hidden md:table-cell">{c.borrowerName ?? '--'}</TableCell>
                  <TableCell className="text-gray-300 hidden md:table-cell">{c.servicerName ?? '--'}</TableCell>
                  <TableCell>
                    <RiskBadge level={config.level} label={config.label} />
                  </TableCell>
                  <TableCell className="text-gray-300 hidden sm:table-cell">{c.documents?.length ?? 0}</TableCell>
                  <TableCell className="text-gray-400 hidden lg:table-cell">{formatRelativeTime(c.created_at)}</TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
