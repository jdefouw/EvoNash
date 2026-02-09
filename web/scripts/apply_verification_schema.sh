#!/bin/bash

# Script to apply verification schema updates
# Usage: ./scripts/apply_verification_schema.sh

# Move to web directory if running from scripts
if [[ $0 == *"scripts/"* ]]; then
  cd "$(dirname "$0")/.."
fi

# Load environment variables from .env
if [ -f .env ]; then
  echo "Loading configuration from .env..."
  export $(grep -v '^#' .env | xargs)
fi

# Try to extract password from DATABASE_URL if PGPASSWORD is not set
if [ -z "$PGPASSWORD" ] && [ ! -z "$DATABASE_URL" ]; then
    # Simple extraction for standard connection strings
    # Format: postgresql://user:password@host:port/db
    if [[ "$DATABASE_URL" =~ :([^:@]+)@ ]]; then
        export PGPASSWORD="${BASH_REMATCH[1]}"
    fi
fi

SCHEMA_FILE="lib/sql/schema_updates.sql"

if [ ! -f "$SCHEMA_FILE" ]; then
  echo "Error: Schema file '$SCHEMA_FILE' not found."
  exit 1
fi

echo "Applying schema updates from $SCHEMA_FILE..."
echo "Target: postgresql://evonash@localhost/evonash"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "Error: psql command not found. Please install PostgreSQL client tools."
    exit 1
fi

# Force connection to localhost as user evonash on db evonash
psql -h localhost -U evonash -d evonash -f "$SCHEMA_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Successfully applied verification schema."
else
    echo "❌ Failed to apply schema updates. Please check your password/connection."
    exit 1
fi
