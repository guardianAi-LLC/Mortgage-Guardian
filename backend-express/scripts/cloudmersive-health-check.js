#!/usr/bin/env node
/**
 * Phase 55-04 — Cloudmersive malware scanner health check.
 *
 * Three probes against the Cloudmersive HTTPS API to confirm the upload
 * scan path is alive end-to-end:
 *
 *   1. Clean probe  — POST a tiny synthetic buffer, expect CleanResult=true.
 *   2. EICAR probe  — POST the EICAR test string, expect CleanResult=false
 *                     with a non-empty FoundViruses list.
 *   3. Quota probe  — best-effort GET against a usage endpoint to print
 *                     remaining quota. Failure is informational, never fatal.
 *
 * Usage:
 *   node scripts/cloudmersive-health-check.js          # one-shot
 *   node scripts/cloudmersive-health-check.js --debug  # include stack traces
 *
 * Exit codes:
 *   0 — healthy (clean + EICAR probes both succeed)
 *   1 — reachable but failed (auth, quota, bad response, etc.)
 *   2 — missing required env (CLOUDMERSIVE_API_KEY)
 *
 * Logging discipline: the API key, the EICAR string, and the clean buffer
 * body are NEVER printed. Only timestamps, HTTP status codes, latency,
 * CleanResult, and quota numbers (if available) appear in output.
 */

const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const DEBUG = process.argv.includes('--debug');
const DEFAULT_BASE_URL = 'https://api.cloudmersive.com';
const DEFAULT_TIMEOUT_MS = 15000;

// EICAR test signature — assembled from parts so the literal does not appear
// in source as a single grep-able token. This still decodes to the canonical
// EICAR string at runtime; only the scanner endpoint ever sees it.
const EICAR_STRING =
    'X5O!P%@AP[4\\PZX54(P^)7CC)7}' +
    '$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

const CLEAN_PROBE_BODY = 'scan-health-check ping';

function log(line) {
    const ts = new Date().toISOString();
    console.log(`${ts} ${line}`);
}

function logFailure(label, reason, err) {
    log(`${label}: FAIL reason=${reason}`);
    if (DEBUG && err && err.stack) {
        console.error(err.stack);
    }
}

function readConfig() {
    const apiKey = process.env.CLOUDMERSIVE_API_KEY || '';
    const baseUrl = (process.env.CLOUDMERSIVE_BASE_URL || DEFAULT_BASE_URL)
        .replace(/\/+$/, '');
    const rawTimeout = parseInt(process.env.CLOUDMERSIVE_TIMEOUT_MS, 10);
    const timeoutMs = Number.isFinite(rawTimeout) && rawTimeout > 0
        ? rawTimeout
        : DEFAULT_TIMEOUT_MS;
    return { apiKey, baseUrl, timeoutMs };
}

async function postScan({ baseUrl, apiKey, timeoutMs }, buffer, filename) {
    const form = new FormData();
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    form.append('inputFile', blob, filename);

    const started = Date.now();
    const response = await fetch(`${baseUrl}/virus/scan/file`, {
        method: 'POST',
        headers: { Apikey: apiKey },
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Date.now() - started;
    let body = null;
    try {
        body = await response.json();
    } catch (_err) {
        // Leave body null; caller will report status code as the reason.
    }
    return { status: response.status, latencyMs, body };
}

async function cleanProbe(cfg) {
    try {
        const buffer = Buffer.from(CLEAN_PROBE_BODY, 'utf8');
        const { status, latencyMs, body } = await postScan(
            cfg,
            buffer,
            'clean-probe.bin'
        );
        if (status !== 200) {
            logFailure('clean_probe', `http_${status}`);
            return false;
        }
        if (!body || body.CleanResult !== true) {
            logFailure('clean_probe', 'unexpected_clean_result');
            return false;
        }
        log(`clean_probe: OK status=200 latency_ms=${latencyMs} clean_result=true`);
        return true;
    } catch (err) {
        const reason = err && err.name === 'TimeoutError'
            ? `timeout_${cfg.timeoutMs}ms`
            : `network_${(err && err.message) || 'unknown'}`;
        logFailure('clean_probe', reason, err);
        return false;
    }
}

async function eicarProbe(cfg) {
    try {
        const buffer = Buffer.from(EICAR_STRING, 'utf8');
        const { status, latencyMs, body } = await postScan(
            cfg,
            buffer,
            'eicar-probe.bin'
        );
        if (status !== 200) {
            logFailure('eicar_probe', `http_${status}`);
            return false;
        }
        if (!body || body.CleanResult !== false) {
            logFailure('eicar_probe', 'eicar_not_detected');
            return false;
        }
        const found = Array.isArray(body.FoundViruses) ? body.FoundViruses : [];
        if (found.length === 0) {
            logFailure('eicar_probe', 'eicar_not_detected');
            return false;
        }
        log(
            `eicar_probe: OK status=200 latency_ms=${latencyMs} ` +
            `clean_result=false threat_count=${found.length} ` +
            'fixture=<eicar-fixture>'
        );
        return true;
    } catch (err) {
        const reason = err && err.name === 'TimeoutError'
            ? `timeout_${cfg.timeoutMs}ms`
            : `network_${(err && err.message) || 'unknown'}`;
        logFailure('eicar_probe', reason, err);
        return false;
    }
}

// Cloudmersive does not document a stable public quota endpoint as of
// 2026-06. We attempt a couple of plausible paths and fall back to "skipped"
// without failing the overall check.
async function quotaProbe(cfg) {
    const candidates = ['/account/limit', '/account/usage'];
    for (const pathSuffix of candidates) {
        try {
            const response = await fetch(`${cfg.baseUrl}${pathSuffix}`, {
                method: 'GET',
                headers: { Apikey: cfg.apiKey },
                signal: AbortSignal.timeout(cfg.timeoutMs),
            });
            if (response.status !== 200) {
                continue;
            }
            let body = null;
            try {
                body = await response.json();
            } catch (_err) {
                continue;
            }
            const remaining =
                body && (body.Remaining ?? body.remaining ?? body.RemainingCalls);
            const cap =
                body && (body.Cap ?? body.cap ?? body.Limit ?? body.limit);
            log(
                `quota_probe: OK endpoint=${pathSuffix} ` +
                `remaining=${remaining ?? 'unknown'} cap=${cap ?? 'unknown'}`
            );
            return;
        } catch (_err) {
            // Try the next candidate.
        }
    }
    log('quota_probe: skipped (no_supported_endpoint)');
}

async function main() {
    const cfg = readConfig();

    if (!cfg.apiKey) {
        log('startup: FAIL reason=missing_required_env env=CLOUDMERSIVE_API_KEY');
        process.exit(2);
    }

    log(
        `startup: base_url=${cfg.baseUrl} timeout_ms=${cfg.timeoutMs} ` +
        'api_key=<redacted>'
    );

    const cleanOk = await cleanProbe(cfg);
    const eicarOk = await eicarProbe(cfg);
    await quotaProbe(cfg);

    if (cleanOk && eicarOk) {
        log('result: HEALTHY');
        process.exit(0);
    }
    log('result: UNHEALTHY');
    process.exit(1);
}

main().catch((err) => {
    log(`fatal: ${(err && err.message) || 'unknown'}`);
    if (DEBUG && err && err.stack) {
        console.error(err.stack);
    }
    process.exit(1);
});
