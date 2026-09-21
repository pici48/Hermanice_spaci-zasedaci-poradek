#!/bin/zsh
# Postaví index.html, zkontroluje ho a pushne na GitHub.
# Když je repo napojené na Vercel, push na hlavní větev spustí produkční deploy.
#
# POZOR: Vercel servíruje index.html, ne template.html. Kdyby se zapomnělo
# na build, změna se na web nedostane a přitom v gitu vypadá hotově.
# Proto se build dělá vždycky a před commitem se kontroluje, že soubor vznikl.
set -e
cd "$(dirname "$0")"

MSG="${1:-}"
[ -z "$MSG" ] && { echo "použití: ./deploy.sh \"popis změny\""; exit 1; }

node build.mjs || { echo "BUILD SELHAL, nic nepushuju"; exit 1; }

# Kontroly: nesmí zůstat placeholder a musí sedět počet vložených obrázků.
grep -q '__IMG_' index.html && { echo "CHYBA: nesubstituovaný placeholder v index.html"; exit 1; }
N=$(grep -o 'data:image/jpeg;base64,' index.html | wc -l | tr -d ' ')
[ "$N" -eq 3 ] || { echo "CHYBA: v index.html je $N obrázků místo 3"; exit 1; }

if git diff --quiet && git diff --cached --quiet; then
  echo "nic se nezměnilo, není co pushovat"
  exit 0
fi

git add -A
git commit -q -m "$MSG"     # commituje se pod vaší vlastní git identitou
git push -q origin "$(git branch --show-current)"
echo "pushnuto: $(git log --oneline -1)"
