// TypeScript interfaces matching the backend OpenAPI spec

// ---------------------------------------------------------------------------
// Shared enrichment types (Phases 51, 52, 53)
// ---------------------------------------------------------------------------

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface SourceDocumentRef {
  id?: string
  name: string
  type?: string
  subtype?: string
}

export interface PageReference {
  documentId: string
  documentName: string
  pageNumber: number
}

export interface SupportingFinding {
  findingId: string
  findingType: string
  quotedText?: string | null
}

export interface EvidenceFootnote {
  findingId?: string | null
  documentName: string
  pageNumber?: number | null
  quotedText?: string | null
  citation: string
  context?: string
}

export interface ExecutiveSummary {
  headline?: string
  narrative?: string
  keyFindings?: string[]
  generatedAt?: string
}

/**
 * Mixin applied to any finding-shaped object that may carry Phase 51 evidence,
 * Phase 52 reasoning, and/or Phase 53 derived display strings. All fields are
 * optional so callers tolerate un-enriched legacy reports.
 */
export interface FindingEnrichment {
  // Phase 51 evidence
  pageReference?: number | null
  quotedText?: string | null
  sourceDocument?: SourceDocumentRef | null
  // Phase 52 reasoning
  reasoningSteps?: string[]
  confidence?: number | null
  confidenceLevel?: ConfidenceLevel | null
  // Phase 53 derived display
  formattedCitation?: string | null
  reasoningSummary?: string | null
  confidenceLabel?: string | null
}

/**
 * Per-document evidence carried on cross-document discrepancies (Phase 51-02).
 */
export interface DiscrepancyDocumentEvidence {
  documentId: string
  documentName: string
  documentType?: string
  pageNumber?: number | null
  quotedText?: string | null
}

export interface Case {
  id: string
  caseName: string
  borrowerName?: string
  propertyAddress?: string
  loanNumber?: string
  servicerName?: string
  status: 'open' | 'in_review' | 'complete' | 'archived'
  notes?: string
  documents?: Document[]
  created_at: string
  updated_at?: string
}

export interface Document {
  document_id: string
  file_name: string
  document_type: string
  analysis_report?: AnalysisReport
  created_at: string
  pipeline_status?: string
}

export interface AnalysisReport {
  documentInfo: {
    documentId: string
    fileName: string
    classificationType: string
    classificationSubtype: string
  }
  completeness: {
    score: number
    totalExpected: number
    totalFound: number
  }
  anomalies: Anomaly[]
  summary: {
    riskLevel: string
    keyFindings: string[]
  }
}

export interface Anomaly extends FindingEnrichment {
  id: string
  field: string
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  description: string
}

export interface PipelineStatus {
  documentId: string
  status: 'uploaded' | 'ocr' | 'classifying' | 'analyzing' | 'analyzed' | 'review' | 'complete' | 'failed'
  steps: Record<string, { status: string; method?: string }>
}

export interface ConsolidatedReport {
  reportId: string
  caseId: string
  userId: string
  generatedAt: string
  reportVersion: string
  caseSummary: {
    borrowerName: string
    propertyAddress: string
    loanNumber: string
    servicerName: string
    documentCount: number
    caseCreatedAt: string
  }
  overallRiskLevel: 'critical' | 'high' | 'medium' | 'low' | 'clean'
  confidenceScore: {
    overall: number
    breakdown: {
      documentAnalysis: number
      forensicAnalysis: number | null
      complianceAnalysis: number | null
    }
    classificationImpact?: {
      confidenceUsed: number
      factor: number
      layerAffected: string
    }
  }
  findingSummary: {
    totalFindings: number
    bySeverity: Record<string, number>
    byCategory: Record<string, number>
  }
  documentAnalysis: DocumentAnalysisItem[]
  forensicFindings: {
    discrepancies: Discrepancy[]
    timelineViolations: TimelineViolation[]
    paymentVerification: PaymentVerification | null
  }
  complianceFindings: {
    federalViolations: Violation[]
    stateViolations: Violation[]
    jurisdiction: { propertyState?: string; servicerState?: string; applicableStates: string[] } | null
  }
  evidenceLinks: EvidenceLink[]
  recommendations: Recommendation[]
  disputeLetterAvailable: boolean
  disputeLetter: DisputeLetter | null
  /** Phase 53-02: pre-rendered narrative summary, null when no findings */
  executiveSummary?: ExecutiveSummary | null
}

export interface DocumentAnalysisItem {
  documentId: string
  documentName: string
  type: string
  subtype: string
  completenessScore: number
  anomalyCount: number
  anomalies: Anomaly[]
  keyFindings: string[]
}

export interface Discrepancy extends FindingEnrichment {
  id: string
  type: string
  severity: string
  description: string
  documentIds: string[]
  regulation?: string
  /** Per-document evidence A (Phase 51-02) */
  documentA?: DiscrepancyDocumentEvidence
  /** Per-document evidence B (Phase 51-02) */
  documentB?: DiscrepancyDocumentEvidence
}

export interface TimelineViolation {
  description: string
  severity: string
  relatedDocuments: string[]
  regulation?: string
}

export interface PaymentVerification {
  verified: boolean
  transactionsAnalyzed: number
  matchedCount: number
  unmatchedCount: number
  findings: string[]
}

export interface Violation extends FindingEnrichment {
  id: string
  statuteId: string
  sectionId: string
  statuteName: string
  sectionTitle: string
  citation: string
  severity: string
  description: string
  legalBasis: string
  jurisdiction?: string
  potentialPenalties?: string
  recommendations?: string[]
  /** Source documents linked to this violation (Phase 51-03) */
  sourceDocuments?: SourceDocumentRef[]
  /** Supporting findings that triggered this violation (Phase 51-03) */
  supportingFindings?: SupportingFinding[]
  /** Page references across source documents (Phase 51-03) */
  pageReferences?: PageReference[]
  /** Legacy pre-enrichment source IDs */
  sourceDocumentIds?: string[]
}

export interface EvidenceLink {
  findingId: string
  findingType: string
  sourceDocumentIds: string[]
  evidenceDescription: string
  severity: string
  /** Human-readable source document names (Phase 51-04) */
  sourceDocumentNames?: string[]
  /** Page references across source documents (Phase 51-04) */
  pageReferences?: PageReference[]
  /** IDs of supporting findings for violation-type links (Phase 51-04) */
  supportingFindingIds?: string[]
}

export interface Recommendation {
  priority: number
  category: string
  action: string
  legalBasis: string | null
  relatedFindingIds: string[]
}

export interface DisputeLetter {
  letterType: 'qualified_written_request' | 'notice_of_error' | 'request_for_information'
  generatedAt: string
  content: {
    subject: string
    salutation: string
    body: string
    demands: string[]
    legalCitations: string[]
    responseDeadline: string
    closingStatement: string
    /** Structured evidence footnotes (Phase 53-03) */
    evidenceFootnotes?: EvidenceFootnote[]
  }
  recipientInfo: {
    servicerName: string
    servicerAddress: string
  }
}

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'clean'
export type CaseStatus = 'open' | 'in_review' | 'complete' | 'archived'

// --------------------------------------------------------------------------
// Plaid
// --------------------------------------------------------------------------

export interface PlaidAccount {
  account_id: string
  name: string
  official_name?: string
  type: string
  subtype: string
  mask?: string
  balances: {
    available: number | null
    current: number | null
    limit?: number | null
    currency: string
  }
}

export interface PlaidTransaction {
  transaction_id: string
  account_id: string
  amount: number
  date: string
  name: string
  merchant_name?: string
  category?: string[]
  pending: boolean
}

export interface PlaidItem {
  itemId: string
  institutionId: string | null
  institutionName?: string
  status: string
  updatedAt: string
  accounts: PlaidAccount[]
  consentExpirationTime?: string | null
}

export interface PlaidLinkResult {
  linkToken: string
  expiration: string
}

export interface PlaidExchangeResult {
  item_id: string
}
