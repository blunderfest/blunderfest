#!/usr/bin/env bash
# Local Blunderfest development environment setup. Idempotent.
# Run from the project root:  bash execute.sh
set -e

echo "==> 0. Ensuring all Erlang/OTP components are installed (idempotent)"
sudo pacman -S --needed --noconfirm \
  erlang-public_key erlang-ssl erlang-inets erlang-asn1 \
  erlang-parsetools erlang-mnesia erlang-sasl || true

echo "==> 1. Granting this user read access to the PostgreSQL data directory"
if ! id -nG | grep -qw postgres; then
  sudo usermod -aG postgres "$(id -un)"
  echo "    added $(id -un) to the postgres group (effective on next login)"
fi
sudo chmod g+rX /var/lib/postgres/data 2>/dev/null || true
sudo find /var/lib/postgres/data -maxdepth 1 -type f -exec chmod g+r {} + 2>/dev/null || true

echo "==> 2. Initializing PostgreSQL data directory (first run only)"
if sudo -u postgres test -f /var/lib/postgres/data/PG_VERSION; then
  echo "    already initialized, skipping"
elif [ -z "$(sudo ls -A /var/lib/postgres/data 2>/dev/null)" ]; then
  sudo -u postgres /usr/bin/initdb --locale=C.UTF-8 --encoding=UTF8 -D /var/lib/postgres/data
else
  STALE="/var/lib/postgres/data.incomplete.$(date +%s)"
  echo "    incomplete cluster found; moving it aside to $STALE"
  sudo systemctl stop postgresql || true
  sudo mv /var/lib/postgres/data "$STALE"
  sudo -u postgres /usr/bin/initdb --locale=C.UTF-8 --encoding=UTF8 -D /var/lib/postgres/data
fi

echo "==> 3. Starting PostgreSQL"
sudo systemctl enable --now postgresql

echo "==> 4. Setting the postgres password Phoenix uses in local dev"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" || true

echo "==> Done. Backend + DB ready."