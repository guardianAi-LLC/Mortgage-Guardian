'use client'

import { PageHeader } from '@/components/page-header'
import { StatsCard } from '@/components/stats-card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { useAnalytics } from '@/hooks/use-analytics'
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'
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

const STATUS_COLORS: Record<string, string> = {
  open: '#3b82f6',
  in_review: '#f59e0b',
  complete: '#10b981',
  archived: '#71717a',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_review: 'In Review',
  complete: 'Complete',
  archived: 'Archived',
}

function CasesByStatusChart({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((sum, v) => sum + v, 0)
  const chartData = Object.entries(data).map(([name, value]) => ({
    name: STATUS_LABELS[name] ?? name,
    value,
    key: name,
  }))

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 min-h-[300px] flex flex-col">
      <h3 className="text-white font-semibold text-lg mb-4">Cases by Status</h3>
      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">No data</p>
        </div>
      ) : (
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                strokeWidth={0}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={STATUS_COLORS[entry.key] ?? '#71717a'} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const item = payload[0]
                  const pct = total > 0 ? ((item.value as number) / total * 100).toFixed(1) : '0'
                  return (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-lg">
                      <p className="text-white font-medium">{item.name}</p>
                      <p className="text-gray-400">{item.value} ({pct}%)</p>
                    </div>
                  )
                }}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                formatter={(value: string) => (
                  <span className="text-sm text-zinc-400">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#10b981',
  info: '#3b82f6',
}

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
}

function FindingSeverityChart({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((sum, v) => sum + v, 0)
  const chartData = Object.entries(data).map(([name, value]) => ({
    name: SEVERITY_LABELS[name] ?? name,
    value,
    key: name,
    fill: SEVERITY_COLORS[name] ?? '#71717a',
  }))

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 min-h-[300px] flex flex-col">
      <h3 className="text-white font-semibold text-lg mb-4">Finding Severity</h3>
      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">No data</p>
        </div>
      ) : (
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={300}>
            <RechartsBarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#a1a1aa', fontSize: 12 }}
                axisLine={{ stroke: '#3f3f46' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#a1a1aa', fontSize: 12 }}
                axisLine={{ stroke: '#3f3f46' }}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const item = payload[0]
                  return (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-lg">
                      <p className="text-white font-medium">{item.payload.name}</p>
                      <p className="text-gray-400">{item.value} findings</p>
                    </div>
                  )
                }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
              </Bar>
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function TopCategoriesChart({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((sum, v) => sum + v, 0)
  const chartData = Object.entries(data).map(([name, value]) => ({
    name,
    value,
  }))

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 min-h-[300px] flex flex-col">
      <h3 className="text-white font-semibold text-lg mb-4">Top Categories</h3>
      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">No data</p>
        </div>
      ) : (
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={300}>
            <RechartsBarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#a1a1aa', fontSize: 12 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#a1a1aa', fontSize: 12 }}
                width={120}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const item = payload[0]
                  return (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-lg">
                      <p className="text-white font-medium">{item.payload.name}</p>
                      <p className="text-gray-400">{item.value} findings</p>
                    </div>
                  )
                }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

const RISK_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#10b981',
  clean: '#3b82f6',
}

const RISK_LABELS: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  clean: 'Clean',
}

function RiskDistributionChart({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((sum, v) => sum + v, 0)
  const chartData = Object.entries(data).map(([name, value]) => ({
    name: RISK_LABELS[name] ?? name,
    value,
    key: name,
    fill: RISK_COLORS[name] ?? '#71717a',
  }))

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 min-h-[300px] flex flex-col">
      <h3 className="text-white font-semibold text-lg mb-4">Risk Distribution</h3>
      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">No data</p>
        </div>
      ) : (
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={300}>
            <RechartsBarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#a1a1aa', fontSize: 12 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#a1a1aa', fontSize: 12 }}
                width={70}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const item = payload[0]
                  return (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-lg">
                      <p className="text-white font-medium">{item.payload.name}</p>
                      <p className="text-gray-400">{item.value} cases</p>
                    </div>
                  )
                }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
              </Bar>
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function CaseTrendChart({ data }: { data: Array<{ month: string; count: number }> }) {
  const hasData = data.length > 0 && data.some((d) => d.count > 0)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 min-h-[300px] flex flex-col">
      <h3 className="text-white font-semibold text-lg mb-4">Case Trend</h3>
      {!hasData ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">No data</p>
        </div>
      ) : (
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="caseTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis
                dataKey="month"
                tick={{ fill: '#a1a1aa', fontSize: 12 }}
                axisLine={{ stroke: '#3f3f46' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#a1a1aa', fontSize: 12 }}
                axisLine={{ stroke: '#3f3f46' }}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-lg">
                      <p className="text-white font-medium">{label}</p>
                      <p className="text-gray-400">{payload[0].value} cases</p>
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#caseTrendFill)"
                dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }}
                activeDot={{ fill: '#3b82f6', strokeWidth: 2, stroke: '#fff', r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
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
            <CasesByStatusChart data={data.casesByStatus} />
            <RiskDistributionChart data={data.riskDistribution} />
          </div>

          {/* Third row: Finding Severity + Top Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FindingSeverityChart data={data.severityBreakdown} />
            <TopCategoriesChart data={data.categoryBreakdown} />
          </div>

          {/* Fourth row: Case Trend + Confidence Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CaseTrendChart data={data.casesByMonth} />
            <ChartPlaceholder title="Confidence Distribution" />
          </div>
        </div>
      )}
    </div>
  )
}
