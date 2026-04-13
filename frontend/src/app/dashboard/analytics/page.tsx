'use client'

import { PageHeader } from '@/components/page-header'
import { StatsCard } from '@/components/stats-card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { useAnalytics } from '@/hooks/use-analytics'
import {
  BarChart3,
  Briefcase,
  FileText,
  AlertTriangle,
  Activity,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'

function ChartPlaceholder({ title }: { title: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 min-h-[300px] flex flex-col">
      <h3 className="text-white font-semibold text-lg mb-4">{title}</h3>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">Chart coming in next plan</p>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 bg-gray-800 rounded-xl" />
        ))}
      </div>
      {/* Two medium cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-[300px] bg-gray-800 rounded-xl" />
        <Skeleton className="h-[300px] bg-gray-800 rounded-xl" />
      </div>
      {/* Two medium cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-[300px] bg-gray-800 rounded-xl" />
        <Skeleton className="h-[300px] bg-gray-800 rounded-xl" />
      </div>
      {/* Two large cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-[350px] bg-gray-800 rounded-xl" />
        <Skeleton className="h-[350px] bg-gray-800 rounded-xl" />
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const { data, isLoading, isError, refetch } = useAnalytics()

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Portfolio-level insights and trends"
      />

      {isLoading && <LoadingSkeleton />}

      {isError && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 flex items-center gap-4">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <div className="flex-1">
            <p className="text-white font-medium">Failed to load analytics data</p>
            <p className="text-sm text-gray-400 mt-1">
              An error occurred while fetching your portfolio data.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-lg bg-red-800/50 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-800/70 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && data && data.portfolioStats.totalCases === 0 && (
        <EmptyState
          icon={BarChart3}
          title="No analytics data"
          description="Create cases and analyze documents to see portfolio insights."
        />
      )}

      {!isLoading && !isError && data && data.portfolioStats.totalCases > 0 && (
        <div className="space-y-6">
          {/* Top row: 4 stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              label="Total Cases"
              value={data.portfolioStats.totalCases}
              icon={Briefcase}
            />
            <StatsCard
              label="Total Documents"
              value={data.portfolioStats.totalDocuments}
              icon={FileText}
            />
            <StatsCard
              label="Total Findings"
              value={data.portfolioStats.totalFindings}
              icon={AlertTriangle}
            />
            <StatsCard
              label="Avg Confidence"
              value={`${data.portfolioStats.avgConfidence}%`}
              icon={Activity}
            />
          </div>

          {/* Second row: Cases by Status + Risk Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartPlaceholder title="Cases by Status" />
            <ChartPlaceholder title="Risk Distribution" />
          </div>

          {/* Third row: Finding Severity + Top Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartPlaceholder title="Finding Severity" />
            <ChartPlaceholder title="Top Categories" />
          </div>

          {/* Fourth row: Case Trend + Confidence Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartPlaceholder title="Case Trend" />
            <ChartPlaceholder title="Confidence Distribution" />
          </div>
        </div>
      )}
    </div>
  )
}
