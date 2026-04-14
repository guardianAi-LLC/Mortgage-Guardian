'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiToken } from '@/lib/hooks'
import { api } from '@/lib/api'
import type { PlaidAccount, PlaidTransaction, PlaidItem, PlaidLinkResult, PlaidExchangeResult } from '@/lib/types'

// --------------------------------------------------------------------------
// Queries
// --------------------------------------------------------------------------

export function usePlaidAccounts(accessToken?: string) {
  const getToken = useApiToken()
  return useQuery<PlaidAccount[]>({
    queryKey: ['plaid-accounts', accessToken],
    queryFn: async () => {
      const token = await getToken()
      const res = await api.plaid.getAccounts(token, accessToken!)
      return res.accounts ?? res
    },
    enabled: !!accessToken,
  })
}

export function usePlaidTransactions(
  accessToken?: string,
  dateRange?: { startDate: string; endDate: string }
) {
  const getToken = useApiToken()
  return useQuery<PlaidTransaction[]>({
    queryKey: ['plaid-transactions', accessToken, dateRange],
    queryFn: async () => {
      const token = await getToken()
      const res = await api.plaid.getTransactions(token, {
        accessToken: accessToken!,
        startDate: dateRange?.startDate,
        endDate: dateRange?.endDate,
      })
      return res.transactions ?? res
    },
    enabled: !!accessToken,
  })
}

export function usePlaidItem(accessToken?: string) {
  const getToken = useApiToken()
  return useQuery<PlaidItem>({
    queryKey: ['plaid-item', accessToken],
    queryFn: async () => {
      const token = await getToken()
      const res = await api.plaid.getItem(token, accessToken!)
      return res.item ?? res
    },
    enabled: !!accessToken,
  })
}

// --------------------------------------------------------------------------
// Mutations
// --------------------------------------------------------------------------

export function useDeletePlaidItem() {
  const getToken = useApiToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (accessToken: string) => {
      const token = await getToken()
      return api.plaid.deleteItem(token, accessToken)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaid-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['plaid-item'] })
      queryClient.invalidateQueries({ queryKey: ['plaid-transactions'] })
    },
  })
}

export function useLinkToken() {
  const getToken = useApiToken()
  return useMutation<PlaidLinkResult, Error, { userId: string }>({
    mutationFn: async (data) => {
      const token = await getToken()
      return api.plaid.createLinkToken(token, data)
    },
  })
}

export function useExchangeToken() {
  const getToken = useApiToken()
  const queryClient = useQueryClient()
  return useMutation<PlaidExchangeResult, Error, { publicToken: string; institution?: object }>({
    mutationFn: async (data) => {
      const token = await getToken()
      return api.plaid.exchangeToken(token, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaid-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['plaid-item'] })
    },
  })
}
