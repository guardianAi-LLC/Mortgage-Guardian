'use client'

import { useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Document } from '@/lib/types'

function truncate(name: string, max = 40): string {
  return name.length > max ? name.slice(0, max) + '...' : name
}

/**
 * Tracks document pipeline_status changes and fires toast notifications
 * when documents reach terminal states (complete or failed).
 * Also invalidates relevant query caches on transitions.
 * Skips notifications on initial load.
 */
export function useDocumentNotifications(documents: Document[]) {
  const prevStatuses = useRef<Map<string, string>>(new Map())
  const queryClient = useQueryClient()

  useEffect(() => {
    const prev = prevStatuses.current
    const isInitialLoad = prev.size === 0

    if (!isInitialLoad) {
      for (const doc of documents) {
        const oldStatus = prev.get(doc.document_id)
        const newStatus = doc.pipeline_status

        if (!newStatus || oldStatus === newStatus) continue

        if (newStatus === 'complete' && oldStatus && oldStatus !== 'complete') {
          toast.success(`${truncate(doc.file_name)} analysis complete`, {
            description: 'View results',
          })
          queryClient.invalidateQueries({ queryKey: ['document-analysis', doc.document_id] })
          queryClient.invalidateQueries({ queryKey: ['analytics'] })
        } else if (newStatus === 'failed' && oldStatus && oldStatus !== 'failed') {
          toast.error(`${truncate(doc.file_name)} processing failed`, {
            description: 'Retry or contact support',
          })
          queryClient.invalidateQueries({ queryKey: ['documents'] })
        }
      }
    }

    // Update ref with current statuses
    const next = new Map<string, string>()
    for (const doc of documents) {
      if (doc.pipeline_status) {
        next.set(doc.document_id, doc.pipeline_status)
      }
    }
    prevStatuses.current = next
  }, [documents, queryClient])
}
