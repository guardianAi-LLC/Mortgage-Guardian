/**
 * Structured Reasoning Configuration
 *
 * Defines the standard reasoning fields, confidence scale, and chain-of-thought
 * prompt instruction templates used across all analysis services.
 *
 * Follows the same declarative pattern as evidenceEnrichmentConfig.js — pure
 * config data with field definitions and reusable prompt fragments. No business
 * logic except the getConfidenceLevel helper.
 *
 * Used by: claudeService, documentAnalysisService, forensicAnalysisService,
 * complianceAnalysisService, and any future service that emits findings.
 */

// ---------------------------------------------------------------------------
// Reasoning Fields
//
// Base reasoning fields attached to every finding. Default values enable
// graceful degradation when Claude doesn't include them — same pattern as
// EVIDENCE_FIELDS in evidenceEnrichmentConfig.js.
// ---------------------------------------------------------------------------

/**
 * Base reasoning fields for every finding, regardless of finding type.
 *
 * - reasoningSteps: ordered chain-of-thought steps Claude used to reach the finding
 * - confidence: numeric score 0–1 reflecting Claude's certainty
 * - confidenceLevel: human-readable tier derived from confidence score
 * - confidenceExplanation: Claude's explanation of why this confidence level was assigned
 */
const REASONING_FIELDS = {
  reasoningSteps: [],
  confidence: null,
  confidenceLevel: null,
  confidenceExplanation: null
};

// ---------------------------------------------------------------------------
// Confidence Scale
//
// Three-tier scale mapping numeric confidence scores to descriptive levels.
// Thresholds chosen to distinguish clear documentary evidence (high), inferential
// reasoning (medium), and circumstantial/insufficient evidence (low).
// ---------------------------------------------------------------------------

/**
 * Confidence tier definitions with score thresholds and descriptions.
 *
 * - high (>= 0.85): Direct documentary evidence with specific values, dates, or amounts
 * - medium (0.50–0.84): Evidence supports finding but requires interpretation or inference
 * - low (< 0.50): Indirect, circumstantial, or insufficient evidence
 */
const CONFIDENCE_SCALE = {
  high: {
    threshold: 0.85,
    label: 'high',
    description:
      'Clear documentary evidence with specific values, dates, or amounts that directly demonstrate the finding'
  },
  medium: {
    minThreshold: 0.5,
    maxThreshold: 0.84,
    label: 'medium',
    description:
      'Evidence supports the finding but requires interpretation, inference, or has minor ambiguity'
  },
  low: {
    threshold: 0.5,
    label: 'low',
    description:
      'Finding is possible but evidence is indirect, circumstantial, or insufficient for definitive conclusion'
  }
};

// ---------------------------------------------------------------------------
// Reasoning Prompt Instructions
//
// Reusable prompt fragments that instruct Claude to show its reasoning and
// assign a confidence score. Append these to analysis prompts to enforce
// reasoning transparency and auditability.
//
// Follows the ENRICHMENT_PROMPT_INSTRUCTIONS pattern from evidenceEnrichmentConfig.js.
// ---------------------------------------------------------------------------

/**
 * Prompt instruction fragments for each analysis context.
 *
 * - ANOMALY_REASONING_INSTRUCTION: for document analysis anomaly detection
 * - DISCREPANCY_REASONING_INSTRUCTION: for forensic cross-document comparison
 * - VIOLATION_REASONING_INSTRUCTION: for compliance/regulatory violation detection
 * - CLASSIFICATION_REASONING_INSTRUCTION: for document type classification
 * - GENERAL_REASONING_INSTRUCTION: broad instruction applicable to all prompts
 */
const REASONING_PROMPT_INSTRUCTIONS = {
  ANOMALY_REASONING_INSTRUCTION:
    'For each anomaly, provide step-by-step reasoning: (1) what value or behavior was expected, ' +
    '(2) what was actually found in the document, (3) why this constitutes an anomaly. ' +
    'Include a confidence score (0.0–1.0) reflecting certainty based on evidence strength, ' +
    'and a one-sentence explanation of why you assigned that confidence level.',

  DISCREPANCY_REASONING_INSTRUCTION:
    'For each discrepancy, show the full reasoning chain: (1) the value found in document A with a direct quote, ' +
    '(2) the conflicting value found in document B with a direct quote, ' +
    '(3) why these values conflict, (4) the regulatory or financial significance of the conflict. ' +
    'Include a confidence score (0.0–1.0) and a brief explanation of your confidence rationale.',

  VIOLATION_REASONING_INSTRUCTION:
    'For each compliance violation, provide the legal reasoning chain: (1) the specific statutory or regulatory requirement, ' +
    '(2) the observed servicer behavior, (3) precisely how that behavior violates the requirement, ' +
    '(4) the potential legal consequence or remedy available to the borrower. ' +
    'Include a confidence score (0.0–1.0) and explain what evidence drove your confidence level.',

  CLASSIFICATION_REASONING_INSTRUCTION:
    'For document classification, explain: (1) which document features were analyzed (layout, headers, terminology), ' +
    '(2) how those features match the assigned document type in the taxonomy, ' +
    '(3) any ambiguous features that reduced certainty. ' +
    'Include a confidence score (0.0–1.0) and a one-sentence confidence rationale.',

  GENERAL_REASONING_INSTRUCTION:
    'Show your work: for each finding, include a reasoningSteps array listing the logical steps that led to your conclusion. ' +
    'Avoid unsupported conclusions — every finding must trace back to specific text in the document. ' +
    'Assign a confidence score (0.0–1.0) based on evidence strength: use high scores (>= 0.85) only when ' +
    'specific values, dates, or amounts directly support the finding; use lower scores when reasoning is inferential.'
};

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Map a numeric confidence score to a high/medium/low level label.
 *
 * Thresholds:
 *   >= 0.85 → 'high'
 *   >= 0.50 → 'medium'
 *    < 0.50 → 'low'
 *
 * @param {number} score - Confidence score in range [0, 1]
 * @returns {'high'|'medium'|'low'} Confidence level label
 */
function getConfidenceLevel(score) {
  if (score >= CONFIDENCE_SCALE.high.threshold) {
    return CONFIDENCE_SCALE.high.label;
  }
  if (score >= CONFIDENCE_SCALE.medium.minThreshold) {
    return CONFIDENCE_SCALE.medium.label;
  }
  return CONFIDENCE_SCALE.low.label;
}

module.exports = {
  REASONING_FIELDS,
  CONFIDENCE_SCALE,
  REASONING_PROMPT_INSTRUCTIONS,
  getConfidenceLevel
};
