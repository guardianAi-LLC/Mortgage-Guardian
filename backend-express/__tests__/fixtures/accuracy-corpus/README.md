# Accuracy Corpus

Labeled mortgage-servicing documents used by `npm run accuracy` to measure the
compliance rule engine's per-rule precision/recall/F1 on real(istic) inputs.

Each subdirectory under this folder is one labeled document fixture. The
accuracy harness (`scripts/accuracy-report.js`) walks every immediate
subdirectory, runs `complianceRuleEngine.evaluateFindings` against it, and
compares the emitted violations to the ground-truth rule IDs in `expected.json`.

## Why this exists

The unit tests in `__tests__/complianceRuleEngine.test.js` prove the engine's
internal logic is consistent. They do NOT measure how well the engine performs
on documents it hasn't been hand-written to match. This corpus is the held-out
evaluation set — the only thing that produces a defensible accuracy number.

Synthetic fixtures here are useful as a regression baseline but **do not
constitute a production accuracy claim**. Real production accuracy requires
anonymized samples from actual servicing files, ideally sourced from:

- Customer files you've been given permission to use (anonymized)
- Public CFPB complaint attachments
- Documents purchased from a compliance-data vendor

## Fixture layout

```
accuracy-corpus/
  <doc-id>/
    meta.json          required - corpus metadata (id, source, docType, ...)
    anomalies.json     required - the pre-extracted anomalies fed to the engine
    expected.json      required - ground truth (rule IDs that should fire)
    statement.txt      optional - raw OCR text, for reference only
    plaid.json         optional - Plaid transactions, for cross-reference tests
    notes.md           optional - human notes on why this doc was labeled this way
```

### `meta.json`

```json
{
  "id": "m001-s04-synthetic-statement",
  "source": "synthetic",                  // synthetic | anonymized-customer | cfpb-public | vendor
  "docType": "servicing",                 // servicing | origination | escrow | payoff | noi | other
  "docSubtype": "monthly_statement",
  "createdAt": "2026-05-29",
  "labeledBy": "engineering",
  "description": "Synthetic monthly statement with excessive late fee + undisclosed escrow shortage allocation."
}
```

### `anomalies.json`

An array of anomaly objects matching the shape the engine expects from
`documentAnalysisService.analyzeDocument`. See the existing `m001-s04`
fixture in `__tests__/fixtures/m001-s04/expected-anomalies.json` for the
canonical shape. Required fields per anomaly: `field`, `type`, `severity`,
`description`, `pageNumber`, `quotedText`, `confidence`.

### `expected.json`

```json
{
  "expectedRuleIds": ["rule-respa-001", "rule-respa-004", "rule-cfpb-006"],
  "minConfidence": 0.5,
  "citationRegex": "12 CFR § 102[46]",
  "notes": "Late fee >4% of P&I; escrow shortage allocation not disclosed; early intervention notice missing."
}
```

- `expectedRuleIds`: the set of rule IDs that SHOULD fire. Any rule that fires
  and is in this list is a true positive; rules that fire outside this list are
  false positives; rules in this list that don't fire are false negatives.
- `minConfidence`: violations below this confidence are ignored (default 0).
- `citationRegex`: optional sanity check on at least one citation.

## Adding a real document

1. Anonymize: scrub names, account numbers, addresses, signatures, dollar
   amounts that could identify the borrower (general magnitudes are fine).
2. OCR or transcribe into `statement.txt` (reference only).
3. Run the doc through the pipeline manually (or use existing analysis output)
   to produce `anomalies.json`. Hand-verify the anomalies are correct — this
   is the input we're testing the engine on, not its output.
4. Read the doc carefully and write `expected.json` from first principles:
   which rules SHOULD fire? Cite the statute for each.
5. `npm run accuracy` — confirm new doc parses and contributes to the report.

## Running the report

```bash
cd backend-express
npm run accuracy           # writes reports/accuracy-latest.{json,md}
```

Exit code is 0 when the report runs successfully — it does NOT fail on low
accuracy. Read the markdown report and decide.
