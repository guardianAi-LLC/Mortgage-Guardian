'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { useDocuments } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

export default function DocumentsPage() {
  const [page, setPage] = useState(0)
  const { data, isLoading } = useDocuments({ limit: PAGE_SIZE, offset: page * PAGE_SIZE })

  const documents = data?.documents ?? []
  const total = data?.total ?? 0
  const start = page * PAGE_SIZE + 1
  const end = Math.min((page + 1) * PAGE_SIZE, total)
  const hasPrev = page > 0
  const hasNext = end < total

  return (
    <div>
      <PageHeader
        title="Documents"
        description="All uploaded mortgage documents across your cases"
      />

      {isLoading ? (
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800 hover:bg-transparent">
              <TableHead className="text-gray-400">File Name</TableHead>
              <TableHead className="text-gray-400">Type</TableHead>
              <TableHead className="text-gray-400">Status</TableHead>
              <TableHead className="text-gray-400">Anomalies</TableHead>
              <TableHead className="text-gray-400">Date Added</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <LoadingRows />
          </TableBody>
        </Table>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Upload documents to your cases to start the analysis process."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-transparent">
                <TableHead className="text-gray-400">File Name</TableHead>
                <TableHead className="text-gray-400">Type</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400">Anomalies</TableHead>
                <TableHead className="text-gray-400">Date Added</TableHead>
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
                      <Link
                        href={`/dashboard/documents/${doc.document_id}`}
                        className="font-medium text-white hover:text-blue-400"
                      >
                        {doc.file_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-gray-300 capitalize">{doc.document_type}</TableCell>
                    <TableCell>{statusBadge(doc.pipeline_status)}</TableCell>
                    <TableCell>
                      <RiskBadge
                        level={anomalyLevel(anomalyCount)}
                        label={`${anomalyCount} found`}
                      />
                    </TableCell>
                    <TableCell className="text-gray-400">{formatRelativeTime(doc.created_at)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 px-2">
            <p className="text-sm text-gray-400">
              Showing {start}–{end} of {total}
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
