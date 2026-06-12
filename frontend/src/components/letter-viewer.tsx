'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { Copy, Printer, Check, Download, Loader2 } from 'lucide-react'
import type { DisputeLetter } from '@/lib/types'

const letterTypeLabels: Record<string, string> = {
  qualified_written_request: 'Qualified Written Request (QWR)',
  notice_of_error: 'Notice of Error (NOE)',
  request_for_information: 'Request for Information (RFI)',
}

interface LetterViewerProps {
  letter: DisputeLetter
}

export function LetterViewer({ letter }: LetterViewerProps) {
  const [copied, setCopied] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const { letterType, generatedAt, content, recipientInfo } = letter
  const evidenceFootnotes = content.evidenceFootnotes ?? []

  const fullText = buildPlainText(letter)

  async function handleDownloadPdf() {
    setDownloadingPdf(true)
    try {
      const [{ pdf }, { LetterPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./letter-pdf'),
      ])
      const blob = await pdf(<LetterPDF letter={letter} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = buildFileName(letter)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingPdf(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = fullText
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 border">
            {letterTypeLabels[letterType] ?? letterType}
          </Badge>
          <span className="text-xs text-gray-500">
            Generated {formatDate(generatedAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <Check className="mr-1.5 h-3.5 w-3.5 text-green-400" />
            ) : (
              <Copy className="mr-1.5 h-3.5 w-3.5" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            {downloadingPdf ? 'Building…' : 'Download PDF'}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print
          </Button>
        </div>
      </div>

      {/* Letter document */}
      <div className="rounded-xl border border-gray-700 bg-gray-50 text-gray-900 print:border-none print:bg-white print:shadow-none">
        <div className="mx-auto max-w-2xl px-10 py-12 space-y-6 text-sm leading-relaxed">
          {/* Recipient */}
          {recipientInfo && (
            <div className="space-y-0.5">
              <p className="font-semibold">{recipientInfo.servicerName}</p>
              {recipientInfo.servicerAddress && (
                <p className="whitespace-pre-line text-gray-600">
                  {recipientInfo.servicerAddress}
                </p>
              )}
            </div>
          )}

          {/* Date */}
          <p className="text-gray-600">{formatDate(generatedAt)}</p>

          {/* Subject */}
          <div>
            <p className="font-bold">
              Re: {content.subject}
            </p>
          </div>

          {/* Salutation */}
          <p>{content.salutation}</p>

          {/* Body */}
          <div className="space-y-4 whitespace-pre-line">{content.body}</div>

          {/* Demands */}
          {content.demands.length > 0 && (
            <div className="space-y-2">
              <p className="font-semibold">Demands:</p>
              <ol className="list-decimal space-y-1.5 pl-5">
                {content.demands.map((demand, i) => (
                  <li key={i}>{demand}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Legal citations */}
          {content.legalCitations.length > 0 && (
            <div className="space-y-2">
              <p className="font-semibold">Legal Citations:</p>
              <ul className="list-disc space-y-1 pl-5 text-gray-700">
                {content.legalCitations.map((citation, i) => (
                  <li key={i}>{citation}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Deadline */}
          {content.responseDeadline && (
            <p className="font-semibold text-red-700">
              Response required by: {content.responseDeadline}
            </p>
          )}

          {/* Closing */}
          <div className="space-y-4 pt-4">
            <p>{content.closingStatement}</p>
          </div>

          {/* Evidence Footnotes (Phase 53-03) */}
          {evidenceFootnotes.length > 0 && (
            <section className="border-t border-gray-300 pt-4 mt-6 print:border-gray-400">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
                Evidence Footnotes
              </h3>
              <ol className="list-decimal pl-5 space-y-2 text-xs leading-relaxed text-gray-800">
                {evidenceFootnotes.map((fn, i) => (
                  <li key={fn.findingId ?? i} id={`footnote-${i + 1}`}>
                    <span className="font-mono">{fn.citation}</span>
                    {fn.context && (
                      <span className="block mt-0.5 text-gray-600">
                        {fn.context}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body > *:not(.print-target) {
            display: none !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
          .print\\:bg-white {
            background: white !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  )
}

function buildFileName(letter: DisputeLetter): string {
  const subject = (letter.content.subject || letter.letterType || 'dispute-letter')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  const dateStr = letter.generatedAt
    ? new Date(letter.generatedAt).toISOString().slice(0, 10)
    : 'undated'
  return `${letter.letterType}_${subject}_${dateStr}.pdf`
}

function buildPlainText(letter: DisputeLetter): string {
  const { content, recipientInfo } = letter
  const parts: string[] = []

  if (recipientInfo) {
    parts.push(recipientInfo.servicerName)
    if (recipientInfo.servicerAddress) parts.push(recipientInfo.servicerAddress)
    parts.push('')
  }

  parts.push(`Re: ${content.subject}`)
  parts.push('')
  parts.push(content.salutation)
  parts.push('')
  parts.push(content.body)
  parts.push('')

  if (content.demands.length > 0) {
    parts.push('Demands:')
    content.demands.forEach((d, i) => parts.push(`${i + 1}. ${d}`))
    parts.push('')
  }

  if (content.legalCitations.length > 0) {
    parts.push('Legal Citations:')
    content.legalCitations.forEach((c) => parts.push(`- ${c}`))
    parts.push('')
  }

  if (content.responseDeadline) {
    parts.push(`Response required by: ${content.responseDeadline}`)
    parts.push('')
  }

  parts.push(content.closingStatement)

  if (content.evidenceFootnotes && content.evidenceFootnotes.length > 0) {
    parts.push('')
    parts.push('Evidence Footnotes:')
    content.evidenceFootnotes.forEach((fn, i) => {
      parts.push(`${i + 1}. ${fn.citation}`)
      if (fn.context) {
        parts.push(`   — ${fn.context}`)
      }
    })
  }

  return parts.join('\n')
}
