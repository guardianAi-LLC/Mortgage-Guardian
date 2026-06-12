'use client'

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { DisputeLetter } from '@/lib/types'

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 64,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#111',
    lineHeight: 1.5,
  },
  recipientBlock: { marginBottom: 16 },
  recipientName: { fontFamily: 'Helvetica-Bold' },
  recipientAddress: { color: '#444' },
  date: { color: '#444', marginBottom: 16 },
  subject: { fontFamily: 'Helvetica-Bold', marginBottom: 12 },
  salutation: { marginBottom: 12 },
  body: { marginBottom: 12 },
  sectionHeading: { fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  listItem: { marginBottom: 4 },
  citationItem: { marginBottom: 3, color: '#333' },
  deadline: { fontFamily: 'Helvetica-Bold', color: '#b91c1c', marginBottom: 12 },
  closing: { marginTop: 16, marginBottom: 12 },
  footnotesSection: {
    borderTopWidth: 1,
    borderTopColor: '#9ca3af',
    paddingTop: 12,
    marginTop: 24,
  },
  footnotesHeading: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#374151',
    marginBottom: 6,
  },
  footnoteItem: { fontSize: 9, marginBottom: 4, color: '#1f2937' },
  footnoteCitation: { fontFamily: 'Courier' },
  footnoteContext: { color: '#4b5563', marginTop: 1 },
})

const letterTypeLabels: Record<string, string> = {
  qualified_written_request: 'Qualified Written Request (QWR)',
  notice_of_error: 'Notice of Error (NOE)',
  request_for_information: 'Request for Information (RFI)',
}

function formatDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

interface LetterPDFProps {
  letter: DisputeLetter
}

export function LetterPDF({ letter }: LetterPDFProps) {
  const { letterType, generatedAt, content, recipientInfo } = letter
  const footnotes = content.evidenceFootnotes ?? []
  const title = `${letterTypeLabels[letterType] ?? letterType} — ${content.subject}`

  return (
    <Document
      title={title}
      author={recipientInfo?.servicerName ?? 'Mortgage Guardian'}
      subject={content.subject}
    >
      <Page size="LETTER" style={styles.page}>
        {recipientInfo && (
          <View style={styles.recipientBlock}>
            <Text style={styles.recipientName}>{recipientInfo.servicerName}</Text>
            {recipientInfo.servicerAddress && (
              <Text style={styles.recipientAddress}>
                {recipientInfo.servicerAddress}
              </Text>
            )}
          </View>
        )}

        <Text style={styles.date}>{formatDate(generatedAt)}</Text>

        <Text style={styles.subject}>Re: {content.subject}</Text>

        <Text style={styles.salutation}>{content.salutation}</Text>

        <Text style={styles.body}>{content.body}</Text>

        {content.demands.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.sectionHeading}>Demands:</Text>
            {content.demands.map((demand, i) => (
              <Text key={i} style={styles.listItem}>
                {i + 1}. {demand}
              </Text>
            ))}
          </View>
        )}

        {content.legalCitations.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.sectionHeading}>Legal Citations:</Text>
            {content.legalCitations.map((c, i) => (
              <Text key={i} style={styles.citationItem}>
                • {c}
              </Text>
            ))}
          </View>
        )}

        {content.responseDeadline && (
          <Text style={styles.deadline}>
            Response required by: {content.responseDeadline}
          </Text>
        )}

        <Text style={styles.closing}>{content.closingStatement}</Text>

        {footnotes.length > 0 && (
          <View style={styles.footnotesSection}>
            <Text style={styles.footnotesHeading}>Evidence Footnotes</Text>
            {footnotes.map((fn, i) => (
              <View key={fn.findingId ?? i} style={styles.footnoteItem}>
                <Text>
                  {i + 1}.{' '}
                  <Text style={styles.footnoteCitation}>{fn.citation}</Text>
                </Text>
                {fn.context && (
                  <Text style={styles.footnoteContext}>{fn.context}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  )
}
