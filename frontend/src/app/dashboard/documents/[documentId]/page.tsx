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
} from 'lucide-react'
import { useDocument, useDocumentStatus, useDeleteDocument, useRetryDocument } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
import { formatRelativeTime } from '@/lib/utils'

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
  const isProcessing = currentStatus && !['complete', 'failed', 'analyzed'].includes(currentStatus)

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
