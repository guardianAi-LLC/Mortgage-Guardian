'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  FileText,
  FolderOpen,
  Calendar,
  Hash,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  ShieldAlert,
} from 'lucide-react'
import { useDocument, useDocumentStatus, useDeleteDocument, useRetryDocument, useDocumentAnalysis } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/page-header'
import { DocumentStatus } from '@/components/document-status'
import { RiskBadge } from '@/components/risk-badge'
import { formatRelativeTime } from '@/lib/utils'
import type { Anomaly } from '@/lib/types'

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
}

function InfoItem({ icon: Icon, label, value, mono }: { icon: React.ElementType; label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-0.5 text-gray-500 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className={`text-sm text-white ${mono ? 'font-mono truncate' : ''}`}>{value || '--'}</p>
      </div>
    </div>
  )
}

export default function DocumentDetailPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = use(params)
  const router = useRouter()
  const { data: document, isLoading } = useDocument(documentId)
  const { data: pipelineStatus } = useDocumentStatus(documentId)
  const deleteDocument = useDeleteDocument()
  const retryDocument = useRetryDocument()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const currentStatus = pipelineStatus?.status ?? document?.pipeline_status
  const isAnalyzed = currentStatus === 'analyzed' || currentStatus === 'complete'
  const isProcessing = currentStatus && !['complete', 'failed', 'analyzed'].includes(currentStatus)

  const { data: analysis } = useDocumentAnalysis(documentId, isAnalyzed)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-60 rounded-xl" />
      </div>
    )
  }

  if (!document) {
    return (
      <div className="text-center py-16">
        <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">Document not found.</p>
        <Link href="/dashboard/documents" className="text-sm text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Back to Documents
        </Link>
      </div>
    )
  }

  function handleDelete() {
    deleteDocument.mutate(documentId, {
      onSuccess: () => {
        router.push('/dashboard/documents')
      },
    })
  }

  function handleRetry() {
    retryDocument.mutate(documentId)
  }

  const sortedAnomalies = analysis?.anomalies
    ? [...analysis.anomalies].sort((a: Anomaly, b: Anomaly) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99))
    : []

  return (
    <div>
      {/* Back link */}
      <Link
        href="/dashboard/documents"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Documents
      </Link>

      {/* Header with actions */}
      <PageHeader title={document.file_name}>
        <Button
          variant="outline"
          className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
          onClick={handleRetry}
          disabled={retryDocument.isPending}
        >
          <RefreshCw className={`h-4 w-4 ${retryDocument.isPending ? 'animate-spin' : ''}`} />
          Re-analyze
        </Button>
        <Button
          variant="outline"
          className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </PageHeader>

      {/* Document info card */}
      <Card className="bg-gray-900 border-gray-800 mb-6">
        <CardHeader>
          <CardTitle className="text-gray-200">Document Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <InfoItem icon={FileText} label="File Name" value={document.file_name} />
            <InfoItem icon={FolderOpen} label="Document Type" value={document.document_type || 'Unclassified'} />
            <InfoItem icon={Calendar} label="Date Added" value={formatRelativeTime(document.created_at)} />
            <InfoItem icon={Hash} label="Document ID" value={document.document_id} mono />
          </div>
        </CardContent>
      </Card>

      {/* Pipeline status card - show if not complete */}
      {(isProcessing || currentStatus === 'failed') && (
        <Card className="bg-gray-900 border-gray-800 mb-6">
          <CardHeader>
            <CardTitle className="text-gray-200">Pipeline Status</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentStatus documentId={documentId} />
          </CardContent>
        </Card>
      )}

      {/* Analysis summary card */}
      {isAnalyzed && analysis ? (
        <Card className="bg-gray-900 border-gray-800 mb-6">
          <CardHeader>
            <CardTitle className="text-gray-200 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Analysis Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Risk level */}
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-400">Risk Level</p>
                  <div className="mt-1">
                    <RiskBadge level={analysis.summary.riskLevel as 'critical' | 'high' | 'medium' | 'low' | 'clean' | 'info'} />
                  </div>
                </div>
              </div>

              {/* Completeness */}
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-400">Completeness</p>
                  <p className="text-sm text-white">
                    {Math.round(analysis.completeness.score * 100)}%
                    <span className="text-gray-500 ml-1">
                      ({analysis.completeness.totalFound}/{analysis.completeness.totalExpected} fields)
                    </span>
                  </p>
                </div>
              </div>

              {/* Anomalies count */}
              <div className="flex items-center gap-3">
                <ListChecks className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-400">Anomalies</p>
                  <p className="text-sm text-white">{analysis.anomalies.length} found</p>
                </div>
              </div>
            </div>

            {/* Key findings */}
            {analysis.summary.keyFindings.length > 0 && (
              <div className="pt-4 border-t border-gray-800">
                <p className="text-xs text-gray-400 mb-2">Key Findings</p>
                <ul className="space-y-1.5">
                  {analysis.summary.keyFindings.map((finding: string, i: number) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-gray-600 mt-0.5">&#8226;</span>
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ) : !isAnalyzed && !isProcessing && currentStatus !== 'failed' ? (
        <Card className="bg-gray-900 border-gray-800 mb-6">
          <CardContent className="py-8 text-center">
            <FileText className="h-10 w-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Analysis not yet available.</p>
            <p className="text-gray-500 text-xs mt-1">
              Click &ldquo;Re-analyze&rdquo; to start processing this document.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Anomalies table */}
      {isAnalyzed && analysis && sortedAnomalies.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-gray-200">Anomalies ({sortedAnomalies.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400">Field</TableHead>
                  <TableHead className="text-gray-400">Type</TableHead>
                  <TableHead className="text-gray-400">Severity</TableHead>
                  <TableHead className="text-gray-400">Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAnomalies.map((anomaly: Anomaly) => (
                  <TableRow key={anomaly.id} className="border-gray-800">
                    <TableCell className="text-gray-200 font-medium">{anomaly.field}</TableCell>
                    <TableCell className="text-gray-400">{anomaly.type}</TableCell>
                    <TableCell>
                      <RiskBadge level={anomaly.severity} />
                    </TableCell>
                    <TableCell className="text-gray-300 max-w-md">{anomaly.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Document</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete &ldquo;{document.file_name}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose
              render={<Button variant="outline" className="border-gray-700 text-gray-300" />}
            >
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteDocument.isPending}
            >
              {deleteDocument.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
