#!/bin/bash
set -e
echo "[XPS] Running database migrations..."
psql "$DATABASE_URL" -f "$(dirname "$0")/schema.sql"
echo "[XPS] Migrations complete."
