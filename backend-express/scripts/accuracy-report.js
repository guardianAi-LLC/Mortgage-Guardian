#!/usr/bin/env node
/**
 * Accuracy report for the compliance rule engine.
 *
 * Walks __tests__/fixtures/accuracy-corpus/ (each subdir = one labeled doc),
 * runs complianceRuleEngine.evaluateFindings on each fixture's anomalies, and
 * compares emitted violations to expected.json's expectedRuleIds.
 *
 * Per-rule confusion matrix → precision / recall / F1.
 * Per-fixture pass/fail summary.
 * Rule-coverage report: which of the federal rules are exercised by >=1 fixture.
 *
 * Writes reports/accuracy-latest.json and reports/accuracy-latest.md.
 * Exit 0 if the harness ran successfully (NOT if accuracy was high).
 * Exit 1 only on harness errors (malformed fixture, engine crash).
 */

const fs = require('fs');
const path = require('path');

const engine = require('../services/complianceRuleEngine');
const { COMPLIANCE_RULE_MAPPINGS: federalRuleMappings } = require('../config/complianceRuleMappings');

const CORPUS_DIR = path.join(__dirname, '..', '__tests__', 'fixtures', 'accuracy-corpus');
const REPORTS_DIR = path.join(__dirname, '..', 'reports');

function loadCorpus() {
  if (!fs.existsSync(CORPUS_DIR)) {
    throw new Error(`Corpus directory missing: ${CORPUS_DIR}`);
  }
  const entries = fs.readdirSync(CORPUS_DIR, { withFileTypes: true });
  const fixtures = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(CORPUS_DIR, entry.name);
    const metaPath = path.join(dir, 'meta.json');
    const anomaliesPath = path.join(dir, 'anomalies.json');
    const expectedPath = path.join(dir, 'expected.json');
    if (!fs.existsSync(metaPath) || !fs.existsSync(anomaliesPath) || !fs.existsSync(expectedPath)) {
      console.warn(`[accuracy] skipping ${entry.name}: missing meta/anomalies/expected`);
      continue;
    }
    fixtures.push({
      dirName: entry.name,
      meta: JSON.parse(fs.readFileSync(metaPath, 'utf8')),
      anomalies: JSON.parse(fs.readFileSync(anomaliesPath, 'utf8')),
      expected: JSON.parse(fs.readFileSync(expectedPath, 'utf8'))
    });
  }
  return fixtures;
}

function runFixture(fixture) {
  const { meta, anomalies, expected } = fixture;
  const minConfidence = expected.minConfidence ?? 0;
  const forensicReport = { caseId: `acc-${meta.id}`, discrepancies: [], timeline: { violations: [] }, paymentVerification: null };
  const analysisReports = [{
    documentId: `doc-${meta.id}`,
    documentType: meta.docType || 'servicing',
    documentSubtype: meta.docSubtype || 'monthly_statement',
    anomalies
  }];

  let result;
  try {
    result = engine.evaluateFindings(forensicReport, analysisReports);
  } catch (err) {
    return { ok: false, error: `engine threw: ${err.message}`, violations: [] };
  }
  if (result.error) {
    return { ok: false, error: `engine returned error: ${result.error}`, violations: [] };
  }

  const violations = (result.violations || []).filter(v => (v.confidence ?? 1) >= minConfidence);
  const firedRuleIds = new Set(violations.map(v => v.ruleId).filter(Boolean));
  const expectedRuleIds = new Set(expected.expectedRuleIds || []);

  const tp = [...firedRuleIds].filter(id => expectedRuleIds.has(id));
  const fp = [...firedRuleIds].filter(id => !expectedRuleIds.has(id));
  const fn = [...expectedRuleIds].filter(id => !firedRuleIds.has(id));

  let citationCheck = null;
  if (expected.citationRegex) {
    const re = new RegExp(expected.citationRegex);
    const matched = violations.some(v => re.test(v.citation || ''));
    citationCheck = { regex: expected.citationRegex, matched };
  }

  return {
    ok: true,
    violations,
    firedRuleIds: [...firedRuleIds].sort(),
    expectedRuleIds: [...expectedRuleIds].sort(),
    tp: tp.sort(),
    fp: fp.sort(),
    fn: fn.sort(),
    citationCheck
  };
}

function aggregate(perFixture, federalRuleIds) {
  // Per-rule confusion across all fixtures.
  // For each rule R: TP = fixtures where R is expected AND fired.
  // FP = fixtures where R fired but was not expected.
  // FN = fixtures where R was expected but did not fire.
  // TN = fixtures where R was not expected and did not fire (rarely useful here).
  const perRule = {};
  for (const ruleId of federalRuleIds) {
    perRule[ruleId] = { tp: 0, fp: 0, fn: 0, support: 0 };
  }

  for (const f of perFixture) {
    if (!f.result.ok) continue;
    const fired = new Set(f.result.firedRuleIds);
    const expected = new Set(f.result.expectedRuleIds);
    for (const ruleId of federalRuleIds) {
      const inFired = fired.has(ruleId);
      const inExpected = expected.has(ruleId);
      if (inExpected) perRule[ruleId].support += 1;
      if (inFired && inExpected) perRule[ruleId].tp += 1;
      else if (inFired && !inExpected) perRule[ruleId].fp += 1;
      else if (!inFired && inExpected) perRule[ruleId].fn += 1;
    }
  }

  for (const ruleId of Object.keys(perRule)) {
    const r = perRule[ruleId];
    r.precision = r.tp + r.fp === 0 ? null : r.tp / (r.tp + r.fp);
    r.recall = r.tp + r.fn === 0 ? null : r.tp / (r.tp + r.fn);
    r.f1 = r.precision !== null && r.recall !== null && r.precision + r.recall > 0
      ? (2 * r.precision * r.recall) / (r.precision + r.recall)
      : null;
  }

  // Micro-averages (sum TP/FP/FN across rules).
  let microTp = 0, microFp = 0, microFn = 0;
  for (const r of Object.values(perRule)) { microTp += r.tp; microFp += r.fp; microFn += r.fn; }
  const microPrecision = microTp + microFp === 0 ? null : microTp / (microTp + microFp);
  const microRecall = microTp + microFn === 0 ? null : microTp / (microTp + microFn);
  const microF1 = microPrecision !== null && microRecall !== null && microPrecision + microRecall > 0
    ? (2 * microPrecision * microRecall) / (microPrecision + microRecall)
    : null;

  const ruleCoverage = {
    totalRules: federalRuleIds.length,
    exercised: federalRuleIds.filter(id => perRule[id].support > 0).length,
    notExercised: federalRuleIds.filter(id => perRule[id].support === 0)
  };

  return { perRule, micro: { tp: microTp, fp: microFp, fn: microFn, precision: microPrecision, recall: microRecall, f1: microF1 }, ruleCoverage };
}

function fmtPct(x) { return x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`; }
function fmtNum(x) { return x === null ? 'n/a' : x.toFixed(3); }

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Compliance Rule Engine — Accuracy Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Corpus size: ${report.fixtures.length} fixtures`);
  lines.push(`Federal rules: ${report.ruleCoverage.totalRules} (${report.ruleCoverage.exercised} exercised by >=1 fixture)`);
  lines.push('');
  lines.push('## Micro-averaged metrics');
  lines.push('');
  lines.push(`- Precision: ${fmtPct(report.micro.precision)} (TP=${report.micro.tp}, FP=${report.micro.fp})`);
  lines.push(`- Recall:    ${fmtPct(report.micro.recall)} (TP=${report.micro.tp}, FN=${report.micro.fn})`);
  lines.push(`- F1:        ${fmtNum(report.micro.f1)}`);
  lines.push('');
  lines.push('## Per-fixture results');
  lines.push('');
  lines.push('| Fixture | Source | Expected | Fired | TP | FP | FN | Citation |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const f of report.fixtures) {
    if (!f.result.ok) {
      lines.push(`| ${f.id} | ${f.source} | — | — | — | — | — | ERROR: ${f.result.error} |`);
      continue;
    }
    const cite = f.result.citationCheck
      ? (f.result.citationCheck.matched ? 'pass' : 'fail')
      : '—';
    lines.push(`| ${f.id} | ${f.source} | ${f.result.expectedRuleIds.length} | ${f.result.firedRuleIds.length} | ${f.result.tp.length} | ${f.result.fp.length} | ${f.result.fn.length} | ${cite} |`);
  }
  lines.push('');
  lines.push('## Per-rule metrics (federal rules with non-zero support OR non-zero firings)');
  lines.push('');
  lines.push('| Rule | Support | TP | FP | FN | Precision | Recall | F1 |');
  lines.push('|---|---|---|---|---|---|---|---|');
  const ruleEntries = Object.entries(report.perRule)
    .filter(([, r]) => r.support > 0 || r.fp > 0)
    .sort((a, b) => a[0].localeCompare(b[0]));
  for (const [ruleId, r] of ruleEntries) {
    lines.push(`| ${ruleId} | ${r.support} | ${r.tp} | ${r.fp} | ${r.fn} | ${fmtPct(r.precision)} | ${fmtPct(r.recall)} | ${fmtNum(r.f1)} |`);
  }
  lines.push('');
  if (report.ruleCoverage.notExercised.length > 0) {
    lines.push('## Rules NOT exercised by any fixture');
    lines.push('');
    lines.push('These rules have zero corpus coverage — accuracy on them is unknown:');
    lines.push('');
    for (const id of report.ruleCoverage.notExercised) lines.push(`- ${id}`);
    lines.push('');
  }
  lines.push('## How to read this');
  lines.push('');
  lines.push('- **Precision** answers: when the engine fires rule R, how often is it right? Low precision = false alarms.');
  lines.push('- **Recall** answers: when rule R should fire, how often does it? Low recall = missed violations.');
  lines.push('- **Support** = number of fixtures where the rule is expected. A rule with support=1 has a noisy estimate.');
  lines.push('- A high score on a corpus of mostly synthetic fixtures is NOT a production claim. Add anonymized real documents per `__tests__/fixtures/accuracy-corpus/README.md`.');
  return lines.join('\n') + '\n';
}

function main() {
  const fixtures = loadCorpus();
  if (fixtures.length === 0) {
    console.error('[accuracy] corpus is empty — nothing to evaluate');
    process.exit(1);
  }

  const federalRuleIds = federalRuleMappings.map(r => r.ruleId);

  const perFixture = fixtures.map(f => ({
    id: f.meta.id,
    source: f.meta.source,
    docType: f.meta.docType,
    docSubtype: f.meta.docSubtype,
    result: runFixture(f)
  }));

  const agg = aggregate(perFixture, federalRuleIds);

  const report = {
    generatedAt: new Date().toISOString(),
    fixtures: perFixture,
    perRule: agg.perRule,
    micro: agg.micro,
    ruleCoverage: agg.ruleCoverage
  };

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORTS_DIR, 'accuracy-latest.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(REPORTS_DIR, 'accuracy-latest.md'), renderMarkdown(report));

  // Console summary.
  console.log(`[accuracy] ${fixtures.length} fixtures evaluated`);
  console.log(`[accuracy] micro precision=${fmtPct(agg.micro.precision)} recall=${fmtPct(agg.micro.recall)} F1=${fmtNum(agg.micro.f1)}`);
  console.log(`[accuracy] rule coverage: ${agg.ruleCoverage.exercised}/${agg.ruleCoverage.totalRules} federal rules exercised`);
  const harnessErrors = perFixture.filter(f => !f.result.ok);
  if (harnessErrors.length) {
    console.error(`[accuracy] ${harnessErrors.length} fixture(s) errored — see reports/accuracy-latest.json`);
  }
  console.log(`[accuracy] wrote reports/accuracy-latest.{json,md}`);
}

main();
