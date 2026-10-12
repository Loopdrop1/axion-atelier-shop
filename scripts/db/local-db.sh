#!/usr/bin/env bash
# Lokale Test-Datenbank (Postgres 16) mit Supabase-Nachbau.
#   scripts/db/local-db.sh start   startet (legt bei Bedarf neu an)
#   scripts/db/local-db.sh reset   löscht die Datenbank und spielt alles neu ein
#   scripts/db/local-db.sh stop    stoppt den Server
# Verbindung: postgres://postgres@127.0.0.1:${AXION_PG_PORT:-54329}/axion
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="$ROOT/.local/pg"
PORT="${AXION_PG_PORT:-54329}"
RUN=()
if [ "$(id -u)" = "0" ]; then RUN=(runuser -u postgres --); fi

psql_db() { PGOPTIONS="--client-min-messages=warning" "$PGBIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

ensure_cluster() {
  if [ ! -f "$DATA/PG_VERSION" ]; then
    mkdir -p "$DATA"
    [ "$(id -u)" = "0" ] && chown -R postgres:postgres "$ROOT/.local"
    "${RUN[@]}" "$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
  fi
}

start() {
  ensure_cluster
  if ! "$PGBIN/pg_isready" -h 127.0.0.1 -p "$PORT" >/dev/null 2>&1; then
    "${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=127.0.0.1 -c fsync=off" -l "$DATA/server.log" -w start >/dev/null
  fi
}

apply_all() {
  psql_db -d axion -f "$ROOT/scripts/db/supabase-compat.sql"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    [ -e "$f" ] || continue
    psql_db -d axion -f "$f"
  done
  if [ -f "$ROOT/supabase/seed.sql" ]; then psql_db -d axion -f "$ROOT/supabase/seed.sql"; fi
}

reset() {
  start
  psql_db -d postgres -c "drop database if exists axion with (force)"
  psql_db -d postgres -c "create database axion"
  apply_all
}

case "${1:-reset}" in
  start) start ;;
  reset) reset ;;
  stop) "${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATA" -m fast stop >/dev/null || true ;;
  *) echo "Unbekannter Befehl: $1" >&2; exit 2 ;;
esac
