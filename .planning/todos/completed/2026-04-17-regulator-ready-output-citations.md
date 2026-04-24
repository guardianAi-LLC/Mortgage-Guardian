---
created: 2026-04-17T21:18
title: Strengthen analysis output for legal defensibility
area: api
files:
  - backend-express/src/services/complianceAnalysisService.js
  - backend-express/src/services/complianceRuleEngine.js
  - backend-express/src/services/documentPipelineService.js
---

## Problem

Analysis outputs need to reach a standard where each claim ties back to specific source data (document page, transaction date, regulation section) and reads like a regulator-ready case file. Currently the pipeline produces confidence scores and findings, but the output may not be structured for third-party audit without trusting the model.

Key gaps to evaluate:
- Are citations to source data (specific statements, dates, transactions) always present in findings?
- Is step-by-step logic included so a reviewer can follow reasoning without trusting the AI?
- Is flagging conservative enough (strong claims only, not speculative)?
- Can each output stand on its own under scrutiny?

## Solution

Audit the analysis pipeline output format and strengthen:
1. Require every finding to reference specific source data (page number, transaction ID, date, quoted text)
2. Include step-by-step reasoning chain in findings (not just conclusion)
3. Review confidence thresholds — ensure only high-confidence claims are surfaced as definitive findings vs. flagged for review
4. Structure output to match regulatory case file expectations (clear sections, citations, audit trail)
