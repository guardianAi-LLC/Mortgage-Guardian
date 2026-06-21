'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { useAuth } from '@clerk/nextjs'
import { useLinkToken, useExchangeToken } from '@/hooks/use-plaid-link'

type PlaidHandler = { open: () => void; exit: () => void; destroy: () => void }
type PlaidCDN = {
  create: (config: {
    token: string
    onSuccess: (publicToken: string, metadata: { institution?: { name: string; institution_id: string } }) => void
    onExit?: (err: unknown) => void
    onEvent?: (eventName: string) => void
  }) => PlaidHandler
}

function getPlaid(): PlaidCDN | undefined {
  return (window as unknown as { Plaid?: PlaidCDN }).Plaid
}

export default function ConnectBankPage() {
  const { userId, isLoaded } = useAuth()
  const linkTokenMutation = useLinkToken()
  const exchangeMutation = useExchangeToken()
  const handlerRef = useRef<PlaidHandler | null>(null)

  const [scriptReady, setScriptReady] = useState(false)
  const [status, setStatus] = useState<string>('')

  useEffect(() => {
    if (userId && !linkTokenMutation.data && !linkTokenMutation.isPending) {
      linkTokenMutation.mutate({ userId })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const linkToken = linkTokenMutation.data?.linkToken

  useEffect(() => {
    const Plaid = getPlaid()
    if (!scriptReady || !linkToken || !Plaid) return
    handlerRef.current?.destroy()
    handlerRef.current = Plaid.create({
      token: linkToken,
      onSuccess: (publicToken, metadata) => {
        setStatus('Exchanging public token…')
        exchangeMutation.mutate(
          { publicToken, institution: metadata.institution },
          {
            onSuccess: () => setStatus(`Linked ${metadata.institution?.name ?? 'bank'}.`),
            onError: (err) => setStatus(`Exchange failed: ${err.message}`),
          }
        )
      },
      onExit: (err) => {
        if (err) setStatus(`Link exited with error.`)
      },
    })
    return () => {
      handlerRef.current?.destroy()
      handlerRef.current = null
    }
  }, [scriptReady, linkToken, exchangeMutation])

  const launch = useCallback(() => {
    if (!handlerRef.current) {
      setStatus('Plaid Link not ready yet.')
      return
    }
    setStatus('')
    handlerRef.current.open()
  }, [])

  const ready = scriptReady && !!linkToken && isLoaded && !!userId

  return (
    <>
      <Script
        src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <main className="mx-auto flex max-w-md flex-col gap-6 p-8">
        <header>
          <h1 className="text-2xl font-semibold">Connect a bank</h1>
          <p className="text-sm text-muted-foreground">
            Launch Plaid Link to securely connect your bank account.
          </p>
        </header>

        <button
          type="button"
          onClick={launch}
          disabled={!ready || exchangeMutation.isPending}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {ready ? 'Launch Plaid Link' : 'Preparing…'}
        </button>

        {linkTokenMutation.isError && (
          <p className="text-sm text-red-600">
            Failed to create link token: {linkTokenMutation.error.message}
          </p>
        )}
        {status && <p className="text-sm">{status}</p>}
      </main>
    </>
  )
}
