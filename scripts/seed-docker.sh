#!/bin/sh
set -eu

# Accept the optional separator in: docker compose run --rm seed -- --update.
if [ "${1:-}" = "--" ]; then
  shift
fi

catalog_command=seed
if [ "${1:-}" = "validate-catalog" ]; then
  catalog_command=validate-catalog
  shift
  set -- "$CSV_FILE" "$@"
else
  set -- "$SEARCH_TABLE" "$CSV_FILE" "$@"
fi

exec npm run "$catalog_command" -- \
  "$@" \
  --host db \
  --db "$POSTGRES_DB" \
  --user "$POSTGRES_USER" \
  --password "$POSTGRES_PASSWORD"
