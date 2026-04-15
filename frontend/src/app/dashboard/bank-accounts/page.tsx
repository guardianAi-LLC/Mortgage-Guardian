'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Landmark,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertTriangle,
  Trash2,
} from 'lucide-react'
import {
  usePlaidAccounts,
  usePlaidItem,
  useExchangeToken,
  useDeletePlaidItem,
} from '@/hooks/use-plaid-link'
import { PlaidLinkButton } from '@/components/plaid-link-button'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
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

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'mg_plaid_access_tokens'

function getPlaidAccessTokens(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function addPlaidAccessToken(token: string): void {
  const tokens = getPlaidAccessTokens()
  if (!tokens.includes(token)) {
    tokens.push(token)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  }
}

function removePlaidAccessToken(token: string): void {
  const tokens = getPlaidAccessTokens().filter((t) => t !== token)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
}

// ---------------------------------------------------------------------------
// Currency formatter
// ---------------------------------------------------------------------------

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

// ---------------------------------------------------------------------------
// Account type badge
// ---------------------------------------------------------------------------

function AccountTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    depository: 'bg-emerald-500/20 text-emerald-400',
    credit: 'bg-amber-500/20 text-amber-400',
    loan: 'bg-blue-500/20 text-blue-400',
    investment: 'bg-purple-500/20 text-purple-400',
  }
  const cls = colors[type] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {type}
    </span>
  )
}

// ---------------------------------------------------------------------------
// LinkedItemCard
// ---------------------------------------------------------------------------

function LinkedItemCard({
  accessToken,
  onUnlinked,
}: {
  accessToken: string
  onUnlinked: () => void
}) {
  const {
    data: accounts,
    isLoading: accountsLoading,
    isError: accountsError,
    refetch: refetchAccounts,
  } = usePlaidAccounts(accessToken)
  const {
    data: plaidItem,
    isLoading: itemLoading,
    refetch: refetchItem,
  } = usePlaidItem(accessToken)
  const deleteItem = useDeletePlaidItem()

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [unlinkOpen, setUnlinkOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const toggleExpand = (accountId: string) => {
    setExpanded((prev) => ({ ...prev, [accountId]: !prev[accountId] }))
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refetchAccounts(), refetchItem()])
    setRefreshing(false)
  }

  const handleUnlink = async () => {
    await deleteItem.mutateAsync(accessToken)
    removePlaidAccessToken(accessToken)
    setUnlinkOpen(false)
    onUnlinked()
  }

  const isLoading = accountsLoading || itemLoading
  const needsReauth =
    plaidItem?.consent_expiration_time &&
    new Date(plaidItem.consent_expiration_time) < new Date()

  if (isLoading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <Skeleton className="h-5 w-40 bg-gray-800" />
        <Skeleton className="h-20 w-full bg-gray-800" />
      </div>
    )
  }

  if (accountsError) {
    return (
      <div className="bg-gray-900 border border-red-900/40 rounded-xl p-4">
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertTriangle className="h-4 w-4" />
          <span>Failed to load accounts for this item.</span>
          <Button variant="ghost" size="sm" onClick={handleRefresh} className="ml-auto text-gray-400">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
        {/* Item header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-base">
              {plaidItem?.institution_name ?? 'Unknown Institution'}
            </h3>
            {plaidItem?.consent_expiration_time && (
              <p className="text-xs text-gray-500 mt-0.5">
                Consent expires{' '}
                {new Date(plaidItem.consent_expiration_time).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {needsReauth && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Re-authenticate
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-gray-400 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUnlinkOpen(true)}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Account list */}
        {accounts && accounts.length > 0 ? (
          <div className="space-y-2">
            {accounts.map((acct) => {
              const isExpanded = expanded[acct.account_id] ?? false
              return (
                <div
                  key={acct.account_id}
                  className="border border-gray-800 rounded-lg overflow-hidden"
                >
                  {/* Collapsed row */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(acct.account_id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-white text-sm font-medium truncate">
                        {acct.name}
                      </span>
                      {acct.mask && (
                        <span className="text-gray-500 text-xs">****{acct.mask}</span>
                      )}
                      <AccountTypeBadge type={acct.type} />
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-white text-sm font-medium tabular-nums">
                        {acct.balances.current != null
                          ? fmt.format(acct.balances.current)
                          : '--'}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 border-t border-gray-800 space-y-2 text-sm">
                      {acct.official_name && (
                        <DetailRow label="Official Name" value={acct.official_name} />
                      )}
                      <DetailRow label="Type" value={acct.type} />
                      <DetailRow label="Subtype" value={acct.subtype} />
                      {acct.mask && <DetailRow label="Mask" value={`****${acct.mask}`} />}
                      <DetailRow
                        label="Available"
                        value={
                          acct.balances.available != null
                            ? fmt.format(acct.balances.available)
                            : '--'
                        }
                      />
                      <DetailRow
                        label="Current"
                        value={
                          acct.balances.current != null
                            ? fmt.format(acct.balances.current)
                            : '--'
                        }
                      />
                      {acct.type === 'credit' && acct.balances.limit != null && (
                        <DetailRow
                          label="Credit Limit"
                          value={fmt.format(acct.balances.limit)}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No accounts found for this item.</p>
        )}
      </div>

      {/* Unlink confirmation dialog */}
      <Dialog open={unlinkOpen} onOpenChange={setUnlinkOpen}>
        <DialogContent className="bg-gray-900 border border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Unlink Bank Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to unlink{' '}
              <span className="font-medium text-white">
                {plaidItem?.institution_name ?? 'this institution'}
              </span>
              ? This will remove all associated accounts and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" />}
            >
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleUnlink}
              disabled={deleteItem.isPending}
            >
              {deleteItem.isPending ? 'Unlinking...' : 'Unlink'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// Detail row helper
// ---------------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300 capitalize">{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BankAccountsPage() {
  const [accessTokens, setAccessTokens] = useState<string[]>([])
  const exchangeToken = useExchangeToken()

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    setAccessTokens(getPlaidAccessTokens())
  }, [])

  const handlePlaidSuccess = useCallback(
    async (publicToken: string) => {
      const result = await exchangeToken.mutateAsync({ publicToken })
      addPlaidAccessToken(result.access_token)
      setAccessTokens(getPlaidAccessTokens())
    },
    [exchangeToken]
  )

  const handleUnlinked = useCallback(() => {
    setAccessTokens(getPlaidAccessTokens())
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Bank Accounts"
        description="Link and manage your bank accounts"
      >
        <PlaidLinkButton onSuccess={handlePlaidSuccess} />
      </PageHeader>

      {exchangeToken.isPending && (
        <div className="mb-4 flex items-center gap-2 text-sm text-blue-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
          Linking account...
        </div>
      )}

      {exchangeToken.isError && (
        <div className="mb-4 rounded-lg bg-red-900/20 border border-red-900/40 p-3 text-sm text-red-400">
          Failed to link account. Please try again.
        </div>
      )}

      {accessTokens.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No linked accounts"
          description="Link a bank account to automatically verify mortgage payment transactions and detect servicing errors."
        >
          <PlaidLinkButton onSuccess={handlePlaidSuccess} />
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {accessTokens.map((token) => (
            <LinkedItemCard
              key={token}
              accessToken={token}
              onUnlinked={handleUnlinked}
            />
          ))}
        </div>
      )}
    </div>
  )
}
