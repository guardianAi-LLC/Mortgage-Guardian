'use client'

import { useQuery } from '@tanstack/react-query'
import { useApiToken } from '@/lib/hooks'
import { api } from '@/lib/api'
import type { Case, Document, AnalysisReport, Anomaly } from '@/lib/types'

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

export interface AnalyticsData {
  casesByStatus: Record<string, number>
  casesByMonth: Array<{ month: string; count: number }>
  riskDistribution: Record<string, number>
  severityBreakdown: Record<string, number>
  categoryBreakdown: Record<string, number>
  confidenceScores: number[]
  portfolioStats: {
    totalCases: number
    totalDocuments: number
    totalFindings: number
    avgConfidence: number
    highRiskCount: number
  }
}

function getLastSixMonths(): Array<{ key: string; label: string }> {
  const months: Array<{ key: string; label: string }> = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    months.push({ key, label })
  }
  return months
}

function computeAnalytics(cases: Case[]): AnalyticsData {
  // 1. Cases by status
  const casesByStatus: Record<string, number> = { open: 0, in_review: 0, complete: 0, archived: 0 }
  for (const c of cases) {
    casesByStatus[c.status] = (casesByStatus[c.status] ?? 0) + 1
  }

  // 2. Cases by month (last 6 months)
  const lastSix = getLastSixMonths()
  const monthCounts: Record<string, number> = {}
  for (const m of lastSix) {
    monthCounts[m.key] = 0
  }
  for (const c of cases) {
    if (c.created_at) {
      const d = new Date(c.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (key in monthCounts) {
        monthCounts[key]++
      }
    }
  }
  const casesByMonth = lastSix.map((m) => ({ month: m.label, count: monthCounts[m.key] }))

  // Collect all documents and their analysis reports
  const allDocuments: Document[] = []
  const allReports: AnalysisReport[] = []
  const allAnomalies: Anomaly[] = []

  for (const c of cases) {
    if (c.documents && Array.isArray(c.documents)) {
      for (const doc of c.documents) {
        allDocuments.push(doc)
        if (doc.analysis_report) {
          allReports.push(doc.analysis_report)
          if (doc.analysis_report.anomalies && Array.isArray(doc.analysis_report.anomalies)) {
            allAnomalies.push(...doc.analysis_report.anomalies)
          }
        }
      }
    }
  }

  // 3. Risk distribution from analysis report summaries
  const riskDistribution: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, clean: 0 }
  for (const report of allReports) {
    const risk = report.summary?.riskLevel?.toLowerCase() ?? 'clean'
    riskDistribution[risk] = (riskDistribution[risk] ?? 0) + 1
  }

  // 4. Severity breakdown from all anomalies
  const severityBreakdown: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  for (const anomaly of allAnomalies) {
    const sev = anomaly.severity ?? 'info'
    severityBreakdown[sev] = (severityBreakdown[sev] ?? 0) + 1
  }

  // 5. Category breakdown — top 8 finding categories (anomaly type)
  const categoryMap: Record<string, number> = {}
  for (const anomaly of allAnomalies) {
    const cat = anomaly.type ?? 'unknown'
    categoryMap[cat] = (categoryMap[cat] ?? 0) + 1
  }
  const sortedCategories = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  const categoryBreakdown: Record<string, number> = {}
  for (const [key, val] of sortedCategories) {
    categoryBreakdown[key] = val
  }

  // 6. Confidence scores from completeness
  const confidenceScores: number[] = []
  for (const report of allReports) {
    if (report.completeness?.score != null) {
      confidenceScores.push(report.completeness.score)
    }
  }

  // 7. Portfolio stats
  const totalFindings = allAnomalies.length
  const avgConfidence =
    confidenceScores.length > 0
      ? confidenceScores.reduce((sum, s) => sum + s, 0) / confidenceScores.length
      : 0
  const highRiskCount = allReports.filter((r) => {
    const risk = r.summary?.riskLevel?.toLowerCase()
    return risk === 'critical' || risk === 'high'
  }).length

  const portfolioStats = {
    totalCases: cases.length,
    totalDocuments: allDocuments.length,
    totalFindings,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    highRiskCount,
  }

  return {
    casesByStatus,
    casesByMonth,
    riskDistribution,
    severityBreakdown,
    categoryBreakdown,
    confidenceScores,
    portfolioStats,
  }
}

export function useAnalytics() {
  const getToken = useApiToken()

  const query = useQuery<AnalyticsData>({
    queryKey: ['analytics'],
    queryFn: async () => {
      const res = await api.cases.list(getToken, { limit: 500 })
      const list = res.cases ?? res
      const cases: Case[] = Array.isArray(list) ? list.map(mapCase) : []
      return computeAnalytics(cases)
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  }
}
