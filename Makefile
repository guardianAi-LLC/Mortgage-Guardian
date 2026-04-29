.PHONY: doctor smoke test

# Run the dev-environment health check.
# Exits 0 when all mandatory checks pass; exits N when N checks fail.
# Override env vars for synthetic injection testing:
#   PLAID_CLIENT_ID=placeholder make doctor
#   CLERK_ISSUER_URL=https://bad.example.com make doctor
doctor:
	@bash scripts/doctor.sh

# Run backend smoke tests (auth wiring + audit pipeline).
smoke:
	@bash backend-express/scripts/smoke-auth.sh
	@bash backend-express/scripts/smoke-audit.sh

# Run the backend unit test suite.
test:
	@cd backend-express && npm test
