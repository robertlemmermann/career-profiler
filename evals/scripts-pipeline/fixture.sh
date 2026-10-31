#!/usr/bin/env bash
# Seeds the eval workspace through the skill's own scripts: a valid store (init, the automation
# preference recorded, the senior-swe profile imported) at ./store, plus the posting as a file.
# The runner copies skills/career-profiler to <tmp>/career-profiler and puts evals/ inside it,
# so the scripts sit two levels up; the repository layout is the fallback for local checks.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp_mjs="$here/../../scripts/cp.mjs"
[ -f "$cp_mjs" ] || cp_mjs="$here/../../skills/career-profiler/scripts/cp.mjs"
[ -f "$cp_mjs" ] || { echo "fixture.sh: cp.mjs not found next to $here" >&2; exit 3; }

export CAREER_PROFILER_HOME="$PWD/store"
node "$cp_mjs" store init --json >/dev/null
node "$cp_mjs" gate record --automation draft --statement "Draft things for me to review; never send anything on my behalf." --confirm --json >/dev/null
node "$cp_mjs" store import "$here/fixtures/profile.json" --confirm --json >/dev/null
cp "$here/fixtures/posting.txt" posting.txt
cat > README.txt <<'EOT'
This workspace holds a career-profiler store at ./store (CAREER_PROFILER_HOME=./store, or pass --store ./store)
and a job posting at ./posting.txt. The automation preference is already recorded in the store:
"Draft things for me to review; never send anything on my behalf." (automation: draft, submit: never).
EOT
