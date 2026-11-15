'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiToken } from '@/lib/hooks'
import { api } from '@/lib/api'
import type { PlaidAccount, PlaidTransaction, PlaidItem, PlaidLinkResult, PlaidExchangeResult } from '@/lib/types'

// --------------------------------------------------------------------------
// Queries
// --------------------------------------------------------------------------

export function usePlaidItems() {
  const getToken = useApiToken()
  const query = useQuery<PlaidItem[]>({
    queryKey: ['plaid-items'],
    queryFn: async () => {
      const res = await api.plaid.listItems(getToken)
      return res.items ?? []
    },
  })
  return { items: query.data ?? [], isLoading: query.isLoading, refetch: query.refetch }
}

export function usePlaidAccounts(itemId?: string) {
  const getToken = useApiToken()
  return useQuery<PlaidAccount[]>({
    queryKey: ['plaid-accounts', itemId],
    queryFn: async () => {
      const res = await api.plaid.getAccounts(getToken, itemId!)
      return res.accounts ?? res
    },
    enabled: !!itemId,
  })
}

export function usePlaidTransactions(
  itemId?: string,
  dateRange?: { startDate: string; endDate: string }
) {
  const getToken = useApiToken()
  return useQuery<PlaidTransaction[]>({
    queryKey: ['plaid-transactions', itemId, dateRange],
    queryFn: async () => {
      const res = await api.plaid.getTransactions(getToken, {
        itemId: itemId!,
        startDate: dateRange?.startDate,
        endDate: dateRange?.endDate,
      })
      return res.transactions ?? res
    },
    enabled: !!itemId,
  })
}

export function usePlaidItem(itemId?: string) {
  const getToken = useApiToken()
  return useQuery<PlaidItem>({
    queryKey: ['plaid-item', itemId],
    queryFn: async () => {
      const res = await api.plaid.getItem(getToken, itemId!)
      return res.item ?? res
    },
    enabled: !!itemId,
  })
}

// --------------------------------------------------------------------------
// Mutations
// --------------------------------------------------------------------------

export function useDeletePlaidItem() {
  const getToken = useApiToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      return api.plaid.deleteItem(getToken, itemId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaid-items'] })
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
      return api.plaid.createLinkToken(getToken, data)
    },
  })
}

export function useExchangeToken() {
  const getToken = useApiToken()
  const queryClient = useQueryClient()
  return useMutation<PlaidExchangeResult, Error, { publicToken: string; institution?: object }>({
    mutationFn: async (data) => {
      return api.plaid.exchangeToken(getToken, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plaid-items'] })
      queryClient.invalidateQueries({ queryKey: ['plaid-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['plaid-item'] })
    },
  })
}
