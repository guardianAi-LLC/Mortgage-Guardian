'use client'

import { useAuth } from '@clerk/nextjs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api } from './api'
import type { TokenGetter } from './api'
import type { AnalysisReport, Case, ConsolidatedReport, Document, PipelineStatus } from './types'

// Backend returns snake_case from Supabase; frontend uses camelCase
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCase(raw: any): Case {
  return {
    id: raw.id,
    caseName: raw.case_name ?? raw.caseName ?? '',
    borrowerName: raw.borrower_name ?? raw.borrowerName,
    propertyAddress: raw.property_address ?? raw.propertyAddress,
    loanNumber: raw.loan_number ?? raw.loanNumber,
    servicerName: raw.servicer_name ?? raw.servicerName,
    status: raw.status ?? 'open',
    notes: raw.notes,
    documents: raw.documents,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  }
}

// --------------------------------------------------------------------------
// Auth token hook
// --------------------------------------------------------------------------

/**
 * Phase 56-03: returns a `TokenGetter` rather than a pre-fetched token. The
 * returned function forwards `skipCache` to `useAuth().getToken({ skipCache })`
 * so `fetchWithAuth` can transparently refresh an expired Clerk JWT once on
 * 401, mirroring iOS APIClient retry semantics.
 *
 * Returns `null` (not throws) when Clerk has no session, so anonymous calls
 * propagate cleanly without the wrapper attempting a refresh-retry.
 */
export function useApiToken(): TokenGetter {
  const { getToken } = useAuth()
  return useCallback(async (opts?: { skipCache?: boolean }) => {
    // Use standard Clerk JWT — backend verifies via Clerk JWKS (RS256).
    // The Supabase template JWT has a different issuer and fails JWKS verification.
    return getToken(opts?.skipCache ? { skipCache: true } : undefined)
  }, [getToken])
}

// --------------------------------------------------------------------------
// Cases
// --------------------------------------------------------------------------

export function useCases(params?: { status?: string }) {
  const getToken = useApiToken()
  return useQuery<Case[]>({
    queryKey: ['cases', params],
    queryFn: async () => {
      const res = await api.cases.list(getToken, params)
      // Backend returns { cases: [...], total, userId } — unwrap and map
      const list = res.cases ?? res
      return Array.isArray(list) ? list.map(mapCase) : []
    },
  })
}

export function useCase(caseId: string) {
  const getToken = useApiToken()
  return useQuery<Case>({
    queryKey: ['cases', caseId],
    queryFn: async () => {
      const raw = await api.cases.get(getToken, caseId)
      return mapCase(raw)
    },
    enabled: !!caseId,
  })
}

export function useCreateCase() {
  const getToken = useApiToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { caseName: string; borrowerName?: string; propertyAddress?: string; loanNumber?: string; servicerName?: string }) => {
      return api.cases.create(getToken, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] })
    },
  })
}

export function useUpdateCase(caseId: string) {
  const getToken = useApiToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return api.cases.update(getToken, caseId, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] })
    },
  })
}

export function useDeleteCase() {
  const getToken = useApiToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (caseId: string) => {
      return api.cases.delete(getToken, caseId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] })
    },
  })
}

// --------------------------------------------------------------------------
// Documents
// --------------------------------------------------------------------------

export function useUploadDocument() {
  const getToken = useApiToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { documentId: string; fileName: string; content: string; documentType?: string }) => {
      return api.documents.upload(getToken, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] })
    },
  })
}

export function useProcessDocument() {
  const getToken = useApiToken()
  return useMutation({
    mutationFn: async (data: { documentId: string; fileBuffer?: string; documentText?: string; documentType?: string }) => {
      return api.documents.process(getToken, data)
    },
  })
}

export function useDocumentStatus(documentId: string | null) {
  const getToken = useApiToken()
  return useQuery<PipelineStatus>({
    queryKey: ['document-status', documentId],
    queryFn: async () => {
      return api.documents.status(getToken, documentId!)
    },
    enabled: !!documentId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'complete' || status === 'failed') return false
      return 2000
    },
  })
}

export function useAddDocumentToCase() {
  const getToken = useApiToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ caseId, documentId }: { caseId: string; documentId: string }) => {
      return api.cases.addDocument(getToken, caseId, documentId)
    },
    onSuccess: (_, { caseId }) => {
      queryClient.invalidateQueries({ queryKey: ['cases', caseId] })
    },
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDocument(raw: any): Document {
  return {
    document_id: raw.document_id ?? raw.documentId,
    file_name: raw.file_name ?? raw.fileName,
    document_type: raw.document_type ?? raw.documentType,
    analysis_report: raw.analysis_report ?? raw.analysisReport,
    created_at: raw.created_at ?? raw.createdAt,
    pipeline_status: raw.pipeline_status ?? raw.pipelineStatus,
  }
}

export function useDocuments(params?: { limit?: number; offset?: number }) {
  const getToken = useApiToken()
  return useQuery<{ documents: Document[]; total: number }>({
    queryKey: ['documents', params],
    queryFn: async () => {
      const res = await api.documents.list(getToken, params)
      const list = res.documents ?? res
      const documents = Array.isArray(list) ? list.map(mapDocument) : []
      return { documents, total: res.total ?? documents.length }
    },
    refetchInterval: (query) => {
      const docs = query.state.data?.documents
      if (!docs) return false
      const hasProcessing = docs.some(
        (d) => d.pipeline_status && d.pipeline_status !== 'complete' && d.pipeline_status !== 'failed'
      )
      return hasProcessing ? 3000 : false
    },
  })
}

export function useDocument(documentId: string) {
  const getToken = useApiToken()
  return useQuery<Document>({
    queryKey: ['documents', documentId],
    queryFn: async () => {
      const raw = await api.documents.get(getToken, documentId)
      return mapDocument(raw)
    },
    enabled: !!documentId,
  })
}

export function useDocumentAnalysis(documentId: string, enabled: boolean = false) {
  const getToken = useApiToken()
  return useQuery<AnalysisReport>({
    queryKey: ['document-analysis', documentId],
    queryFn: async () => {
      return api.documents.analysis(getToken, documentId)
    },
    enabled: !!documentId && enabled,
  })
}

export function useDeleteDocument() {
  const getToken = useApiToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (documentId: string) => {
      return api.documents.delete(getToken, documentId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}

export function useRetryDocument() {
  const getToken = useApiToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (documentId: string) => {
      return api.documents.retry(getToken, documentId)
    },
    onSuccess: (_, documentId) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['document-status', documentId] })
    },
  })
}

// --------------------------------------------------------------------------
// Processing count (sidebar badge)
// --------------------------------------------------------------------------

export function useProcessingCount(): number {
  const { data } = useDocuments({ limit: 500, offset: 0 })
  if (!data?.documents) return 0
  return data.documents.filter(
    (d) => d.pipeline_status && !['complete', 'failed'].includes(d.pipeline_status)
  ).length
}

// --------------------------------------------------------------------------
// Forensic Analysis
// --------------------------------------------------------------------------

export function useRunForensicAnalysis(caseId: string) {
  const getToken = useApiToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data?: Record<string, unknown>) => {
      return api.forensic.run(getToken, caseId, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forensic', caseId] })
      queryClient.invalidateQueries({ queryKey: ['cases', caseId] })
    },
  })
}

export function useForensicAnalysis(caseId: string) {
  const getToken = useApiToken()
  return useQuery({
    queryKey: ['forensic', caseId],
    queryFn: async () => {
      return api.forensic.get(getToken, caseId)
    },
    enabled: !!caseId,
    retry: false,
  })
}

// --------------------------------------------------------------------------
// Compliance
// --------------------------------------------------------------------------

export function useRunComplianceEvaluation(caseId: string) {
  const getToken = useApiToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data?: Record<string, unknown>) => {
      return api.compliance.evaluate(getToken, caseId, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance', caseId] })
      queryClient.invalidateQueries({ queryKey: ['cases', caseId] })
    },
  })
}

export function useComplianceReport(caseId: string) {
  const getToken = useApiToken()
  return useQuery({
    queryKey: ['compliance', caseId],
    queryFn: async () => {
      return api.compliance.get(getToken, caseId)
    },
    enabled: !!caseId,
    retry: false,
  })
}

// --------------------------------------------------------------------------
// Reports
// --------------------------------------------------------------------------

export function useGenerateReport(caseId: string) {
  const getToken = useApiToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data?: { generateLetter?: boolean; letterType?: string }) => {
      return api.reports.generate(getToken, caseId, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', caseId] })
      queryClient.invalidateQueries({ queryKey: ['cases', caseId] })
    },
  })
}

export function useReport(caseId: string) {
  const getToken = useApiToken()
  return useQuery<ConsolidatedReport>({
    queryKey: ['report', caseId],
    queryFn: async () => {
      return api.reports.get(getToken, caseId)
    },
    enabled: !!caseId,
    retry: false,
  })
}

export function useGenerateLetter(caseId: string) {
  const getToken = useApiToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { letterType: string }) => {
      return api.reports.generateLetter(getToken, caseId, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', caseId] })
    },
  })
}
