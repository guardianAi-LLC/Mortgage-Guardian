import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const severityStyles: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/30',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  info: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
}

const confidenceStyles: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-green-500/10 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  low: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
}

interface FindingCardProps {
  type: string
  severity: string
  description: string
  details?: Record<string, string>
  formattedCitation?: string | null
  confidenceLabel?: string | null
  confidenceLevel?: 'high' | 'medium' | 'low' | null
  reasoningSteps?: string[]
  reasoningSummary?: string | null
}

export function FindingCard({
  type,
  severity,
  description,
  details,
  formattedCitation,
  confidenceLabel,
  confidenceLevel,
  reasoningSteps,
  reasoningSummary,
}: FindingCardProps) {
  const severityKey = severity.toLowerCase()
  const hasReasoning =
    (reasoningSteps && reasoningSteps.length > 0) || Boolean(reasoningSummary)

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
            {type}
          </span>
          <div className="flex items-center gap-2">
            <Badge
              className={cn(
                'border text-xs capitalize',
                severityStyles[severityKey] ?? severityStyles.info
              )}
            >
              {severity}
            </Badge>
            {confidenceLabel && (
              <Badge
                className={cn(
                  'border text-xs',
                  confidenceStyles[confidenceLevel ?? 'medium']
                )}
              >
                {confidenceLabel}
              </Badge>
            )}
          </div>
        </div>
        <p className="text-sm leading-relaxed text-gray-200">{description}</p>
        {formattedCitation && (
          <div className="rounded-md border border-gray-800 bg-gray-950/50 px-3 py-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-500">
              Source
            </span>
            <p className="mt-0.5 font-mono text-xs text-gray-300">
              {formattedCitation}
            </p>
          </div>
        )}
        {hasReasoning && (
          <details className="group rounded-md border border-gray-800 bg-gray-950/50 px-3 py-2">
            <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-gray-500 marker:hidden">
              Reasoning
              <span className="ml-1 inline-block text-gray-600 transition-transform group-open:rotate-90">
                ›
              </span>
            </summary>
            <div className="mt-2 space-y-1.5 text-xs text-gray-300">
              {reasoningSteps && reasoningSteps.length > 0 ? (
                <ol className="list-decimal space-y-1 pl-4">
                  {reasoningSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              ) : reasoningSummary ? (
                <p>{reasoningSummary}</p>
              ) : null}
            </div>
          </details>
        )}
        {details && Object.keys(details).length > 0 && (
          <div className="space-y-1.5 border-t border-gray-800 pt-3">
            {Object.entries(details).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4 text-xs">
                <span className="text-gray-500">{key}</span>
                <span className="text-right text-gray-300">{value}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
