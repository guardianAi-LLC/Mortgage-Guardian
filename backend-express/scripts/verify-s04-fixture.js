#!/usr/bin/env node
/**
 * S04 fixture verification.
 *
 * Loads the synthetic mortgage statement anomalies fixture, builds a minimal
 * forensicReport + analysisReport, and invokes complianceRuleEngine directly
 * (no HTTP) to prove the fixture triggers the federal rule engine. Asserts:
 *   - violations.length >= expected-findings.json#minViolations
 *   - at least one violation citation matches expected-findings.json#citationRegex
 *
 * Exits 0 on success, 1 on failure.
 */

const path = require('path');
const fs = require('fs');

const fixtureDir = path.join(__dirname, '..', '__tests__', 'fixtures', 'm001-s04');
const anomalies = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'expected-anomalies.json'), 'utf8'));
const expected = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'expected-findings.json'), 'utf8'));

const engine = require('../services/complianceRuleEngine');

const caseId = 'case-s04-fixture';
const documentId = 'doc-s04-statement-001';

const forensicReport = {
  caseId,
  discrepancies: [],
  timeline: { violations: [] },
  paymentVerification: null
};

const analysisReports = [
  {
    documentId,
    documentType: 'servicing',
    documentSubtype: 'monthly_statement',
    anomalies
  }
];

const result = engine.evaluateFindings(forensicReport, analysisReports);

if (result.error) {
  console.error('[verify-s04-fixture] engine error:', result.error);
  process.exit(1);
}

const violations = result.violations || [];
const citationRe = new RegExp(expected.citationRegex);
const matched = violations.filter(v => citationRe.test(v.citation || ''));

console.log(
  `[verify-s04-fixture] fixture triggers ${violations.length} violations, ${matched.length} with citation matching ${expected.citationRegex}`
);

if (violations.length < (expected.minViolations || 1)) {
  console.error(
    `[verify-s04-fixture] FAIL: expected >= ${expected.minViolations} violations, got ${violations.length}`
  );
  console.error('[verify-s04-fixture] violations:', JSON.stringify(violations, null, 2));
  process.exit(1);
}
if (matched.length < 1) {
  console.error('[verify-s04-fixture] FAIL: no violation citation matched expected regex');
  console.error('[verify-s04-fixture] citations seen:', violations.map(v => v.citation));
  process.exit(1);
}

// Spot-check shape so T05 has a stable contract.
const sample = matched[0];
const requiredFields = ['ruleId', 'sectionId', 'citation', 'severity', 'description', 'evidence', 'legalBasis'];
const missing = requiredFields.filter(f => sample[f] === undefined || sample[f] === null);
if (missing.length) {
  console.error('[verify-s04-fixture] FAIL: violation missing fields:', missing);
  process.exit(1);
}

console.log('[verify-s04-fixture] OK');
process.exit(0);
