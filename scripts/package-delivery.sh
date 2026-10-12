#!/usr/bin/env bash
# Lieferpaket für die Übernahme in das Lovable-Repository.
#   scripts/package-delivery.sh [BASIS]     BASIS = Commit des Lovable-Stands (Standard ec0da66)
# Ergebnis in .local/delivery/:
#   axion.patch    alle Commits seit BASIS, für `git am --3way`
#   dateien/       neue und geänderte Dateien in ihrer Ordnerstruktur
#   LOESCHEN.txt   Dateien, die im Lovable-Stand gelöscht werden müssen
#   axion-lieferung-<datum>.zip  alles zusammen
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BASE="${1:-ec0da66}"
OUT="$ROOT/.local/delivery"

git rev-parse --verify --quiet "$BASE^{commit}" >/dev/null || { echo "Basis $BASE nicht gefunden" >&2; exit 1; }
if [ -n "$(git status --porcelain)" ]; then
  echo "Es gibt nicht committete Änderungen. Bitte zuerst committen." >&2
  exit 1
fi

rm -rf "$OUT"
mkdir -p "$OUT/dateien"

git format-patch --binary --stdout "$BASE..HEAD" >"$OUT/axion.patch"

# Neue, geänderte und umbenannte Dateien (Ziel) kopieren
git diff --name-only --diff-filter=ACMR -z "$BASE" HEAD | while IFS= read -r -d '' file; do
  mkdir -p "$OUT/dateien/$(dirname "$file")"
  git show "HEAD:$file" >"$OUT/dateien/$file"
done

# Gelöschte Dateien und alte Namen umbenannter Dateien
{
  git diff --name-only --diff-filter=D "$BASE" HEAD
  git diff --name-status --diff-filter=R "$BASE" HEAD | cut -f2
} | sort -u >"$OUT/LOESCHEN.txt"

copied=$(find "$OUT/dateien" -type f | wc -l | tr -d ' ')
deleted=$(grep -c . "$OUT/LOESCHEN.txt" || true)
commits=$(git rev-list --count "$BASE..HEAD")

cat >"$OUT/LIESMICH.txt" <<EOF
Axion-Shop, Lieferpaket vom $(date +%d.%m.%Y)
Basis: $BASE, Stand: $(git rev-parse --short HEAD), $commits Commits
$copied Dateien in dateien/, $deleted Dateien in LOESCHEN.txt
Anleitung: docs/DEPLOYMENT.md, Abschnitte 1 und 9.
EOF

(cd "$OUT" && zip -qr "axion-lieferung-$(date +%Y-%m-%d).zip" axion.patch dateien LOESCHEN.txt LIESMICH.txt)
echo "Fertig: $OUT ($commits Commits, $copied Dateien, $deleted zu löschen)"
