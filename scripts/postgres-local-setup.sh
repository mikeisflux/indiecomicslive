#!/usr/bin/env bash
# ============================================================================
# scripts/postgres-local-setup.sh
#
# Install PostgreSQL 17 on the app box from the official PGDG apt repo,
# create the `indiecomicslive` database + user with a generated password,
# lock listening to 127.0.0.1, and inject DATABASE_URL into
# /opt/indiecomicslive/.env.local (replacing any existing TODO_/Neon URL).
#
# Idempotent. Safe to re-run.
#
# Single command:
#   curl -fsSL https://raw.githubusercontent.com/mikeisflux/indiecomicslive/claude/whatnot-clone-exploration-VxA1W/scripts/postgres-local-setup.sh | sudo bash
# ============================================================================
set -uo pipefail

[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }

DB_NAME=indiecomicslive
DB_USER=indiecomicslive
ENV_FILE=/opt/indiecomicslive/.env.local
SECRETS_DIR=/root/icl-secrets
PG_VER=17

log() { echo -e "\n\033[1;35m[postgres]\033[0m $*"; }

# ---------------------------------------------------------------------------
# 1. Add PGDG apt repo for Postgres 17
# ---------------------------------------------------------------------------
if [ ! -f /etc/apt/sources.list.d/pgdg.list ]; then
  log "adding PGDG apt repo"
  apt-get install -y -qq curl ca-certificates gnupg lsb-release >/dev/null
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq
fi

# ---------------------------------------------------------------------------
# 2. Install Postgres 17
# ---------------------------------------------------------------------------
if ! command -v psql >/dev/null || ! dpkg -l postgresql-$PG_VER 2>/dev/null | grep -q '^ii'; then
  log "installing postgresql-$PG_VER"
  apt-get install -y -qq postgresql-$PG_VER postgresql-client-$PG_VER >/dev/null
fi

systemctl enable --now postgresql

# ---------------------------------------------------------------------------
# 3. Lock listening to localhost only
# ---------------------------------------------------------------------------
PG_CONF=/etc/postgresql/$PG_VER/main/postgresql.conf
if [ -f "$PG_CONF" ]; then
  if ! grep -qE "^listen_addresses\s*=\s*'localhost'" "$PG_CONF"; then
    sed -i "s|^#\?listen_addresses\s*=.*|listen_addresses = 'localhost'|" "$PG_CONF"
    log "set listen_addresses = 'localhost' in $PG_CONF"
  fi
fi

# ---------------------------------------------------------------------------
# 4. Create role + database (idempotent)
# ---------------------------------------------------------------------------
mkdir -p "$SECRETS_DIR" && chmod 700 "$SECRETS_DIR"
PG_PASS_FILE="$SECRETS_DIR/postgres-app-password"
if [ -f "$PG_PASS_FILE" ]; then
  DB_PASS="$(cat "$PG_PASS_FILE")"
  log "using existing password from $PG_PASS_FILE"
else
  DB_PASS="$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-40)"
  echo -n "$DB_PASS" > "$PG_PASS_FILE"
  chmod 600 "$PG_PASS_FILE"
  log "generated new DB password, saved to $PG_PASS_FILE"
fi

log "ensuring role + database exist"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';
  ELSE
    ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS';
  END IF;
END
\$\$;
SQL

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
  log "created database $DB_NAME owned by $DB_USER"
fi

# Grant Prisma the privileges it needs (CREATE on schema for migrations).
sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
GRANT ALL PRIVILEGES ON SCHEMA public TO $DB_USER;
ALTER SCHEMA public OWNER TO $DB_USER;
SQL

# ---------------------------------------------------------------------------
# 5. Reload Postgres so listen_addresses change takes effect
# ---------------------------------------------------------------------------
systemctl reload postgresql 2>/dev/null || systemctl restart postgresql

# ---------------------------------------------------------------------------
# 6. Smoke test the connection from the app user
# ---------------------------------------------------------------------------
log "smoke-testing connection"
if ! PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -c '\conninfo' >/dev/null 2>&1; then
  echo "  WARN: could not connect with the new password — check pg_hba.conf"
fi

# ---------------------------------------------------------------------------
# 7. Inject DATABASE_URL into .env.local (replace any existing line)
# ---------------------------------------------------------------------------
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME?schema=public"
if [ -f "$ENV_FILE" ]; then
  if grep -q '^DATABASE_URL=' "$ENV_FILE"; then
    # Replace existing line — use | as sed delimiter since URL has /
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" "$ENV_FILE"
    log "updated DATABASE_URL in $ENV_FILE"
  else
    echo "DATABASE_URL=$DATABASE_URL" >> "$ENV_FILE"
    log "appended DATABASE_URL to $ENV_FILE"
  fi
  chown icl:icl "$ENV_FILE" 2>/dev/null || true
  chmod 600 "$ENV_FILE"
else
  log "no $ENV_FILE yet — DATABASE_URL is:"
  echo "  $DATABASE_URL"
fi

# ---------------------------------------------------------------------------
# 8. Summary
# ---------------------------------------------------------------------------
echo
echo "================================================================"
echo "  POSTGRES READY"
echo "================================================================"
echo "  version:   $(sudo -u postgres psql -tAc 'SHOW server_version;' | xargs)"
echo "  listening: $(sudo -u postgres psql -tAc 'SHOW listen_addresses;' | xargs)"
echo "  database:  $DB_NAME"
echo "  user:      $DB_USER"
echo "  password:  saved to $PG_PASS_FILE (mode 600)"
echo "  url:       postgresql://$DB_USER:***@127.0.0.1:5432/$DB_NAME?schema=public"
echo
echo "==> DATABASE_URL is in $ENV_FILE — Prisma will pick it up automatically."
