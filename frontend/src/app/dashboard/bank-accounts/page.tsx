'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Landmark,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Trash2,
  CheckCircle,
  XCircle,
  Info,
} from 'lucide-react'
import {
  usePlaidAccounts,
  usePlaidItem,
  usePlaidTransactions,
  useExchangeToken,
  useDeletePlaidItem,
} from '@/hooks/use-plaid-link'
import { useReport } from '@/lib/hooks'
import { PlaidLinkButton } from '@/components/plaid-link-button'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import type { PlaidAccount, PlaidTransaction, PaymentVerification } from '@/lib/types'

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
// Date helpers
// ---------------------------------------------------------------------------

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Mortgage keyword detection
// ---------------------------------------------------------------------------

const MORTGAGE_KEYWORDS = ['mortgage', 'loan', 'escrow', 'housing']

function isMortgageRelated(tx: PlaidTransaction): boolean {
  const text = `${tx.name} ${tx.merchant_name ?? ''}`.toLowerCase()
  return MORTGAGE_KEYWORDS.some((kw) => text.includes(kw))
}

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
// Payment Verification Card
// ---------------------------------------------------------------------------

function PaymentVerificationCard({
  verification,
}: {
  verification: PaymentVerification
}) {
  const total = verification.transactionsAnalyzed
  const matchedRatio = total > 0 ? (verification.matchedCount / total) * 100 : 0

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-3">
        {verification.verified ? (
          <CheckCircle className="h-5 w-5 text-emerald-400" />
        ) : (
          <XCircle className="h-5 w-5 text-red-400" />
        )}
        <h3 className="text-white font-semibold text-base">
          Payment Verification
        </h3>
        <span
          className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
            verification.verified
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {verification.verified ? 'Verified' : 'Issues Found'}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-white tabular-nums">
            {verification.transactionsAnalyzed}
          </p>
          <p className="text-xs text-gray-500">Analyzed</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">
            {verification.matchedCount}
          </p>
          <p className="text-xs text-gray-500">Matched</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-red-400 tabular-nums">
            {verification.unmatchedCount}
          </p>
          <p className="text-xs text-gray-500">Unmatched</p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Match ratio</span>
          <span>{matchedRatio.toFixed(0)}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              matchedRatio >= 80
                ? 'bg-emerald-500'
                : matchedRatio >= 50
                  ? 'bg-amber-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${matchedRatio}%` }}
          />
        </div>
      </div>

      {/* Findings */}
      {verification.findings.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-400 mb-2">Findings</p>
          <ul className="space-y-1">
            {verification.findings.map((finding, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-gray-600 mt-1.5 block h-1 w-1 rounded-full bg-gray-500 shrink-0" />
                {finding}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function CrossReferenceInfoCard() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <Info className="h-5 w-5 text-blue-400 shrink-0" />
        <div>
          <p className="text-sm text-gray-300">
            Run cross-reference analysis from a case to verify payments against bank transactions.
          </p>
          <Link
            href="/dashboard/cases"
            className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2 mt-1 inline-block"
          >
            Go to Cases
          </Link>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Account entry for selector (flattened across tokens)
// ---------------------------------------------------------------------------

interface AccountEntry {
  accessToken: string
  account: PlaidAccount
}

// ---------------------------------------------------------------------------
// Hook: aggregate accounts across access tokens
// ---------------------------------------------------------------------------

function useAllAccounts(accessTokens: string[]): {
  entries: AccountEntry[]
  isLoading: boolean
} {
  // We call usePlaidAccounts for each token. Since hooks must be called
  // unconditionally, we support up to 10 tokens (pad with undefined).
  const padded = useMemo(() => {
    const arr = [...accessTokens]
    while (arr.length < 10) arr.push('')
    return arr
  }, [accessTokens])

  const q0 = usePlaidAccounts(padded[0] || undefined)
  const q1 = usePlaidAccounts(padded[1] || undefined)
  const q2 = usePlaidAccounts(padded[2] || undefined)
  const q3 = usePlaidAccounts(padded[3] || undefined)
  const q4 = usePlaidAccounts(padded[4] || undefined)
  const q5 = usePlaidAccounts(padded[5] || undefined)
  const q6 = usePlaidAccounts(padded[6] || undefined)
  const q7 = usePlaidAccounts(padded[7] || undefined)
  const q8 = usePlaidAccounts(padded[8] || undefined)
  const q9 = usePlaidAccounts(padded[9] || undefined)

  const queries = [q0, q1, q2, q3, q4, q5, q6, q7, q8, q9]

  const entries = useMemo(() => {
    const result: AccountEntry[] = []
    for (let i = 0; i < accessTokens.length && i < 10; i++) {
      const data = queries[i].data
      if (data) {
        for (const account of data) {
          result.push({ accessToken: accessTokens[i], account })
        }
      }
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    accessTokens,
    q0.data, q1.data, q2.data, q3.data, q4.data,
    q5.data, q6.data, q7.data, q8.data, q9.data,
  ])

  const isLoading = queries.some((q, i) => i < accessTokens.length && q.isLoading)

  return { entries, isLoading }
}

// ---------------------------------------------------------------------------
// TransactionSection
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25

function TransactionSection({ accessTokens }: { accessTokens: string[] }) {
  const { entries: allAccounts, isLoading: accountsLoading } = useAllAccounts(accessTokens)

  // Account selector
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all')

  // Date filters (default: last 90 days)
  const [startDate, setStartDate] = useState(daysAgo(90))
  const [endDate, setEndDate] = useState(daysAgo(0))

  // Amount filters
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')

  // Pagination
  const [page, setPage] = useState(0)

  // Find the access token for the selected account
  const selectedEntry = useMemo(
    () => allAccounts.find((e) => e.account.account_id === selectedAccountId),
    [allAccounts, selectedAccountId]
  )

  // When selecting "all", use the first token; otherwise use the selected account's token
  const activeToken = selectedAccountId === 'all'
    ? accessTokens[0]
    : selectedEntry?.accessToken

  const dateRange = useMemo(
    () => ({ startDate, endDate }),
    [startDate, endDate]
  )

  const {
    data: transactions,
    isLoading: txLoading,
  } = usePlaidTransactions(activeToken, dateRange)

  // Client-side filtering
  const filtered = useMemo(() => {
    if (!transactions) return []

    let result = [...transactions]

    // Filter by account if a specific one is selected
    if (selectedAccountId !== 'all') {
      result = result.filter((tx) => tx.account_id === selectedAccountId)
    }

    // Amount filters
    const min = minAmount !== '' ? parseFloat(minAmount) : null
    const max = maxAmount !== '' ? parseFloat(maxAmount) : null
    if (min !== null && !isNaN(min)) {
      result = result.filter((tx) => Math.abs(tx.amount) >= min)
    }
    if (max !== null && !isNaN(max)) {
      result = result.filter((tx) => Math.abs(tx.amount) <= max)
    }

    // Sort by date descending
    result.sort((a, b) => b.date.localeCompare(a.date))

    return result
  }, [transactions, selectedAccountId, minAmount, maxAmount])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  )

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [selectedAccountId, startDate, endDate, minAmount, maxAmount])

  const isLoading = accountsLoading || txLoading

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
        {allAccounts.length > 1 && (
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="h-8 rounded-lg border border-gray-700 bg-gray-900 px-2 text-sm text-gray-300 outline-none focus:border-blue-500"
          >
            <option value="all">All Accounts</option>
            {allAccounts.map((entry) => (
              <option key={entry.account.account_id} value={entry.account.account_id}>
                {entry.account.name}
                {entry.account.mask ? ` (****${entry.account.mask})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Filters row */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <label className="text-xs text-gray-500">Start Date</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-36 bg-gray-900 text-gray-300 border-gray-700"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500">End Date</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-36 bg-gray-900 text-gray-300 border-gray-700"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500">Min Amount</label>
          <Input
            type="number"
            placeholder="0.00"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            className="w-28 bg-gray-900 text-gray-300 border-gray-700"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500">Max Amount</label>
          <Input
            type="number"
            placeholder="0.00"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            className="w-28 bg-gray-900 text-gray-300 border-gray-700"
          />
        </div>
      </div>

      {/* Transaction table */}
      {isLoading ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-4 w-24 bg-gray-800" />
                <Skeleton className="h-4 w-48 bg-gray-800" />
                <Skeleton className="h-4 w-20 bg-gray-800" />
                <Skeleton className="h-4 w-20 bg-gray-800" />
                <Skeleton className="h-4 w-16 bg-gray-800" />
              </div>
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500">No transactions found for this date range.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-transparent">
                <TableHead className="text-gray-400">Date</TableHead>
                <TableHead className="text-gray-400">Description</TableHead>
                <TableHead className="text-gray-400 text-right">Amount</TableHead>
                <TableHead className="text-gray-400">Category</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((tx) => {
                const mortgage = isMortgageRelated(tx)
                const description = tx.merchant_name
                  ? `${tx.name} - ${tx.merchant_name}`
                  : tx.name
                // Plaid uses positive amounts for debits, negative for credits
                const isDeposit = tx.amount < 0
                const displayAmount = Math.abs(tx.amount)

                return (
                  <TableRow
                    key={tx.transaction_id}
                    className={`border-gray-800 ${
                      mortgage
                        ? 'bg-blue-900/20 border-l-2 border-l-blue-500'
                        : ''
                    }`}
                  >
                    <TableCell className="text-gray-300 text-sm">
                      {formatDate(tx.date)}
                    </TableCell>
                    <TableCell className="text-gray-200 text-sm max-w-[300px] truncate">
                      {description}
                    </TableCell>
                    <TableCell
                      className={`text-sm text-right font-medium tabular-nums ${
                        isDeposit ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {isDeposit ? '+' : '-'}{fmt.format(displayAmount)}
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {tx.category?.[0] ?? '-'}
                    </TableCell>
                    <TableCell>
                      {tx.pending ? (
                        <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                          Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                          Posted
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-gray-800 px-4 py-3">
            <p className="text-xs text-gray-500">
              Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length} transactions
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="text-gray-400 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-xs text-gray-500">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="text-gray-400 hover:text-white"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cross-reference section
// ---------------------------------------------------------------------------

function CrossReferenceSection() {
  const searchParams = useSearchParams()
  const caseId = searchParams.get('caseId')

  const { data: report } = useReport(caseId ?? '')

  const verification = report?.forensicFindings?.paymentVerification ?? null

  if (!caseId || !verification) {
    return <CrossReferenceInfoCard />
  }

  return <PaymentVerificationCard verification={verification} />
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
        <div className="space-y-6">
          {/* Linked accounts */}
          <div className="space-y-4">
            {accessTokens.map((token) => (
              <LinkedItemCard
                key={token}
                accessToken={token}
                onUnlinked={handleUnlinked}
              />
            ))}
          </div>

          {/* Cross-reference verification */}
          <CrossReferenceSection />

          {/* Transactions */}
          <TransactionSection accessTokens={accessTokens} />
        </div>
      )}
    </div>
  )
}
