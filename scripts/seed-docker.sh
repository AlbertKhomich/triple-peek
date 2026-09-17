#!/bin/sh
set -eu

# Accept the optional separator in: docker compose run --rm seed -- --update.
if [ "${1:-}" = "--" ]; then
  shift
fi

exec npm run seed -- \
  "$SEARCH_TABLE" "$CSV_FILE" \
  --host db \
  --db "$POSTGRES_DB" \
  --user "$POSTGRES_USER" \
  --password "$POSTGRES_PASSWORD" \
  "$@"
