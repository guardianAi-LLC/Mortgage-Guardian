'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Landmark, ChevronRight, Loader2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { usePlaidItems, useDeletePlaidItem } from '@/hooks/use-plaid-link'
import type { PlaidItem } from '@/lib/types'

function institutionLabel(item: PlaidItem): string {
  return (
    item.institutionName ||
    (item.institutionId ? `Institution ${item.institutionId}` : 'Linked institution')
  )
}

function statusBadge(status: string): { label: string; classes: string } {
  switch (status?.toLowerCase()) {
    case 'good':
    case 'active':
    case 'ok':
      return { label: 'Active', classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' }
    case 'pending_expiration':
    case 'pending':
      return { label: 'Action required', classes: 'bg-amber-500/10 text-amber-400 border-amber-500/30' }
    case 'login_required':
    case 'error':
      return { label: 'Reconnect needed', classes: 'bg-red-500/10 text-red-400 border-red-500/30' }
    default:
      return { label: status || 'Unknown', classes: 'bg-gray-500/10 text-gray-300 border-gray-500/30' }
  }
}

export function LinkedBankAccountsCard() {
  const { items, isLoading } = usePlaidItems()
  const deleteItem = useDeletePlaidItem()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const pendingItem = items.find((i) => i.itemId === pendingDeleteId)

  async function confirmDisconnect() {
    if (!pendingItem) return
    try {
      await deleteItem.mutateAsync(pendingItem.itemId)
      toast.success(`Disconnected ${institutionLabel(pendingItem)}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect institution'
      toast.error(message)
    } finally {
      setPendingDeleteId(null)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Linked Bank Accounts</h2>
        </div>
        <Link
          href="/dashboard/bank-accounts"
          className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
        >
          Manage
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading linked institutions…
        </div>
      ) : items.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            No bank accounts are linked yet. Connecting your accounts lets Mortgage Guardian
            cross-check payments against your servicer&apos;s records.
          </p>
          <div>
            <Link
              href="/dashboard/bank-accounts"
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Connect a bank
            </Link>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-gray-800">
          {items.map((item) => {
            const badge = statusBadge(item.status)
            const accountCount = item.accounts?.length ?? 0
            const isDeleting = deleteItem.isPending && pendingDeleteId === item.itemId
            return (
              <li
                key={item.itemId}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{institutionLabel(item)}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                    <span>{accountCount === 1 ? '1 account' : `${accountCount} accounts`}</span>
                    <span aria-hidden>•</span>
                    <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${badge.classes}`}>
                      {badge.label}
                    </span>
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Disconnect ${institutionLabel(item)}`}
                  onClick={() => setPendingDeleteId(item.itemId)}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unlink className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Disconnect
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect institution?</DialogTitle>
            <DialogDescription>
              {pendingItem
                ? `${institutionLabel(pendingItem)} will be disconnected and its access token revoked. Existing audit findings that referenced these accounts will remain, but new transaction data will no longer be available. You can reconnect at any time.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              disabled={deleteItem.isPending}
              onClick={confirmDisconnect}
            >
              {deleteItem.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Disconnecting…
                </>
              ) : (
                'Disconnect'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
