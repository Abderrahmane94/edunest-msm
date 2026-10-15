#!/usr/bin/env bash
# Restores a backup made by .github/workflows/backup-db.yml into a database.
#
#   scripts/restore-db.sh <backup.dump.gpg | backup.dump> <target-database-url>
#
# 1. Download the backup: GitHub → Actions → Database backup → the run →
#    Artifacts. Unzip it: inside is kiddoo-<date>.dump.gpg.
# 2. Restore it into a NEW database first (a new Neon branch, or a local
#    container), check it, and only then point the app at it. Restoring over
#    the live database replaces everything in it.
#
# The passphrase is asked for, or read from BACKUP_PASSPHRASE.
# Needs gpg and Docker (the Postgres 18 tools run in a container). For a
# database on this machine, write its host as host.docker.internal.
set -euo pipefail

if [ $# -ne 2 ]; then
  sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
fi

backup=$1
target=$2
[ -f "$backup" ] || { echo "No such file: $backup" >&2; exit 1; }

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
# Git Bash on Windows: Docker needs the Windows path, and no rewriting of /w.
export MSYS_NO_PATHCONV=1
mount=$(cd "$work" && { pwd -W 2>/dev/null || pwd; })

case $backup in
  *.gpg)
    if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
      printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 \
        --decrypt --output "$work/kiddoo.dump" "$backup"
    else
      gpg --pinentry-mode loopback --decrypt --output "$work/kiddoo.dump" "$backup"
    fi
    ;;
  *) cp "$backup" "$work/kiddoo.dump" ;;
esac

# Where it goes, without the password.
shown=$(printf '%s' "$target" | sed -E 's#//[^@]*@#//#; s#\?.*##')
echo
echo "Backup:  $backup"
echo "Target:  $shown"
echo "Everything in the target database will be replaced."
read -r -p 'Type RESTORE to go on: ' answer
[ "$answer" = RESTORE ] || { echo 'Stopped, nothing changed.'; exit 1; }

docker run --rm -e TARGET="$target" -v "$mount:/w" postgres:18-alpine \
  sh -c 'pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --single-transaction \
           --dbname="$TARGET" /w/kiddoo.dump'

echo 'Restored. Rows in the main tables:'
docker run --rm -i -e TARGET="$target" postgres:18-alpine sh -c 'psql "$TARGET" -tA' <<'SQL'
SELECT 'schools', count(*) FROM schools UNION ALL
SELECT 'users', count(*) FROM users UNION ALL
SELECT 'children', count(*) FROM children UNION ALL
SELECT 'payments', count(*) FROM payment_records;
SQL
