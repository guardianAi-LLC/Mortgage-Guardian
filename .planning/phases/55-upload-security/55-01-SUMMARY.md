# 55-01 Summary — Cloudmersive Env Vars

**Completed:** 2026-06-21

## What was done

Added CLOUDMERSIVE_* environment variables to `backend-express/utils/envValidator.js`:
- `CLOUDMERSIVE_API_KEY` — optional string, warned if missing
- `CLOUDMERSIVE_BASE_URL` — optional URI, defaults to `https://api.cloudmersive.com`
- `CLOUDMERSIVE_TIMEOUT_MS` — optional integer, defaults to 10000 ms

Added feature warning: "CLOUDMERSIVE_API_KEY missing — malware scanning will reject all uploads"

Added camelCase keys to the frozen config object:
- `cloudmersiveApiKey`, `cloudmersiveBaseUrl`, `cloudmersiveTimeoutMs`

Documented new vars in `backend-express/.env.example` under a new `# MALWARE SCANNING (Cloudmersive)` section.

## Files changed
- `backend-express/utils/envValidator.js` — schema, warnings, frozen config
- `backend-express/.env.example` — developer documentation
