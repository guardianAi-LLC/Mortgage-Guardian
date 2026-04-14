'use client'

import { useCallback, useEffect, type ReactNode } from 'react'
import { usePlaidLink as usePlaidLinkSDK, type PlaidLinkOnSuccessMetadata } from 'react-plaid-link'
import { useAuth } from '@clerk/nextjs'
import { useLinkToken } from '@/hooks/use-plaid-link'

interface PlaidLinkButtonProps {
  onSuccess: (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => void
  onExit?: () => void
  accessToken?: string
  className?: string
  children?: ReactNode
}

export function PlaidLinkButton({
  onSuccess,
  onExit,
  accessToken,
  className,
  children,
}: PlaidLinkButtonProps) {
  const { userId } = useAuth()
  const linkTokenMutation = useLinkToken()
  const linkToken = linkTokenMutation.data?.linkToken ?? ''

  // Create link token on mount
  useEffect(() => {
    if (userId && !linkToken && !linkTokenMutation.isPending) {
      linkTokenMutation.mutate({ userId })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const onSuccessCallback = useCallback(
    (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      onSuccess(publicToken, metadata)
    },
    [onSuccess]
  )

  const { open, ready } = usePlaidLinkSDK({
    token: linkToken || null,
    onSuccess: onSuccessCallback,
    onExit: onExit ? () => onExit() : undefined,
  })

  const isLoading = linkTokenMutation.isPending || (!ready && !!linkToken)

  return (
    <button
      type="button"
      onClick={() => open()}
      disabled={!ready || isLoading}
      className={
        className ??
        'inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
      }
    >
      {isLoading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Connecting...
        </>
      ) : (
        children ?? 'Link Bank Account'
      )}
      {linkTokenMutation.isError && (
        <span className="ml-2 text-xs text-red-300">Failed to connect</span>
      )}
    </button>
  )
}
