#!/usr/bin/env bash
# One command, no spend: temporary database + replay server + the UR-1042 walkthrough, then cleanup.
# The password is generated here and never printed. No API key or spend ledger reaches the server.
set -euo pipefail
PROJECT_ID="${NEON_PROJECT_ID:-wild-glitter-74311356}"
DB="ur_walk_$(date +%s)_test"
SERVER_PID=""
DB_CREATED=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null || true; fi
  if [ -n "$DB_CREATED" ]; then npx neonctl databases delete "$DB" --project-id "$PROJECT_ID" >/dev/null 2>&1 || echo "Could not delete $DB; remove it by hand."; fi
}
trap cleanup EXIT
if lsof -ti tcp:3000 -sTCP:LISTEN >/dev/null 2>&1; then echo "Port 3000 is in use. Stop that server first."; exit 1; fi
echo "Preparing a temporary database and build (about a minute)..."
npx neonctl databases create --project-id "$PROJECT_ID" --name "$DB" --owner-name neondb_owner >/dev/null
DB_CREATED=1
OWNER=$(npx neonctl connection-string --project-id "$PROJECT_ID" --database-name "$DB" --owner-name neondb_owner 2>/dev/null)
export NODE_NO_WARNINGS=1 DATABASE_URL="$OWNER" AGENT_REPLAY=1 AGENT_RECORD=0 ANTHROPIC_API_KEY= SPEND_LEDGER_URL= DEMO_NOW=2026-11-03T09:00:00-05:00
export DEMO_CREDENTIAL_CLINICIAN_A="$(openssl rand -hex 16)"
npm run --silent db:migrate >/dev/null
npm run --silent db:seed >/dev/null
npm run --silent build >/dev/null
node_modules/.bin/next start -p 3000 >/dev/null 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 30); do curl -s -o /dev/null http://localhost:3000/api/auth/csrf && break; sleep 1; done
npx tsx --conditions=react-server scripts/demo-walkthrough.ts
