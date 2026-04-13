'use client'

import { useAuth } from '@clerk/nextjs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api } from './api'
import type { Case, ConsolidatedReport, Document, PipelineStatus } from './types'

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

export function useApiToken() {
  const { getToken } = useAuth()
  return useCallback(async () => {
    // Use standard Clerk JWT — backend verifies via Clerk JWKS (RS256).
    // The Supabase template JWT has a different issuer and fails JWKS verification.
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    return token
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
      const token = await getToken()
      const res = await api.cases.list(token, params)
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
      const token = await getToken()
      const raw = await api.cases.get(token, caseId)
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
      const token = await getToken()
      return api.cases.create(token, data)
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
      const token = await getToken()
      return api.cases.update(token, caseId, data)
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
      const token = await getToken()
      return api.cases.delete(token, caseId)
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
      const token = await getToken()
      return api.documents.upload(token, data)
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
      const token = await getToken()
      return api.documents.process(token, data)
    },
  })
}

export function useDocumentStatus(documentId: string | null) {
  const getToken = useApiToken()
  return useQuery<PipelineStatus>({
    queryKey: ['document-status', documentId],
    queryFn: async () => {
      const token = await getToken()
      return api.documents.status(token, documentId!)
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
      const token = await getToken()
      return api.cases.addDocument(token, caseId, documentId)
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
      const token = await getToken()
      const res = await api.documents.list(token, params)
      const list = res.documents ?? res
      const documents = Array.isArray(list) ? list.map(mapDocument) : []
      return { documents, total: res.total ?? documents.length }
    },
  })
}

export function useDocument(documentId: string) {
  const getToken = useApiToken()
  return useQuery<Document>({
    queryKey: ['documents', documentId],
    queryFn: async () => {
      const token = await getToken()
      const raw = await api.documents.get(token, documentId)
      return mapDocument(raw)
    },
    enabled: !!documentId,
  })
}

export function useDeleteDocument() {
  const getToken = useApiToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (documentId: string) => {
      const token = await getToken()
      return api.documents.delete(token, documentId)
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
      const token = await getToken()
      return api.documents.retry(token, documentId)
    },
    onSuccess: (_, documentId) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['document-status', documentId] })
    },
  })
}

// --------------------------------------------------------------------------
// Forensic Analysis
// --------------------------------------------------------------------------

export function useRunForensicAnalysis(caseId: string) {
  const getToken = useApiToken()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data?: Record<string, unknown>) => {
      const token = await getToken()
      return api.forensic.run(token, caseId, data)
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
      const token = await getToken()
      return api.forensic.get(token, caseId)
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
      const token = await getToken()
      return api.compliance.evaluate(token, caseId, data)
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
      const token = await getToken()
      return api.compliance.get(token, caseId)
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
      const token = await getToken()
      return api.reports.generate(token, caseId, data)
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
      const token = await getToken()
      return api.reports.get(token, caseId)
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
      const token = await getToken()
      return api.reports.generateLetter(token, caseId, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', caseId] })
    },
  })
}
