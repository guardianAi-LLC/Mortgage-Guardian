/**
 * Evidence Enrichment Configuration
 *
 * Defines the standard evidence enrichment fields used across all analysis
 * services. This is the shared data contract that ensures every finding
 * carries page references, quoted text, and document metadata for legal
 * defensibility.
 *
 * This is config data — declarative, no business logic.
 *
 * Used by: documentAnalysisService, forensicAnalysisService,
 * complianceAnalysisService, consolidated report generator.
 */

// ---------------------------------------------------------------------------
// Evidence Fields
//
// Standard enrichment fields every finding should include, regardless of
// finding type (anomaly, discrepancy, violation).
// ---------------------------------------------------------------------------

/**
 * Base evidence fields attached to every individual finding.
 *
 * - sourceDocument: identifies which document the finding came from
 * - pageReference: the page number where evidence was found (null if unknown)
 * - quotedText: exact quoted text supporting the finding (max 500 chars)
 * - quotedTextContext: surrounding text for additional context (max 200 chars)
 */
const EVIDENCE_FIELDS = {
  sourceDocument: {
    id: null,
    name: null,
    type: null,
    subtype: null
  },
  pageReference: null,
  quotedText: null,
  quotedTextContext: null
};

// ---------------------------------------------------------------------------
// Discrepancy Evidence Fields
//
// Enrichment for cross-document discrepancies found during forensic analysis.
// Each discrepancy references two or more documents with per-document evidence.
// ---------------------------------------------------------------------------

/**
 * Per-document evidence structure for cross-document discrepancies.
 * Each document involved in the discrepancy gets its own evidence record.
 */
const DISCREPANCY_EVIDENCE_FIELDS = {
  perDocument: {
    documentId: null,
    documentName: null,
    documentType: null,
    field: null,
    value: null,
    pageReference: null,
    quotedText: null
  }
};

// ---------------------------------------------------------------------------
// Violation Evidence Fields
//
// Enrichment for compliance violations. Violations aggregate evidence from
// multiple source documents and supporting findings (anomalies/discrepancies).
// ---------------------------------------------------------------------------

/**
 * Evidence structure for compliance violations.
 *
 * - sourceDocuments: which documents triggered the violation
 * - supportingFindings: anomalies/discrepancies that support this violation
 * - pageReferences: specific page citations across documents
 */
const VIOLATION_EVIDENCE_FIELDS = {
  sourceDocuments: [
    {
      id: null,
      name: null,
      type: null
    }
  ],
  supportingFindings: [
    {
      findingId: null,
      findingType: null,
      quotedText: null
    }
  ],
  pageReferences: [
    {
      documentId: null,
      documentName: null,
      pageNumber: null
    }
  ]
};

// ---------------------------------------------------------------------------
// Enrichment Prompt Instructions
//
// Reusable prompt fragments that tell Claude to include evidence metadata
// in its response. These are appended to analysis prompts to enforce
// citation discipline and evidence traceability.
// ---------------------------------------------------------------------------

/**
 * Prompt instruction fragments for each evidence context.
 *
 * - ANOMALY_EVIDENCE_INSTRUCTION: added to document analysis prompts
 * - DISCREPANCY_EVIDENCE_INSTRUCTION: added to forensic comparison prompts
 * - GENERAL_EVIDENCE_INSTRUCTION: added to all prompts for citation discipline
 */
const ENRICHMENT_PROMPT_INSTRUCTIONS = {
  ANOMALY_EVIDENCE_INSTRUCTION:
    'For each anomaly, include: pageNumber (integer, the page where found), quotedText (exact text from document supporting this finding, max 500 chars).',

  DISCREPANCY_EVIDENCE_INSTRUCTION:
    'For each discrepancy per document, include: pageNumber (integer), quotedText (exact text from that document).',

  GENERAL_EVIDENCE_INSTRUCTION:
    'Always cite specific values, dates, amounts directly from source text. Never make claims without quoting the source.'
};

module.exports = {
  EVIDENCE_FIELDS,
  DISCREPANCY_EVIDENCE_FIELDS,
  VIOLATION_EVIDENCE_FIELDS,
  ENRICHMENT_PROMPT_INSTRUCTIONS
};
