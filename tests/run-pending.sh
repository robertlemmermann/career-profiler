#!/usr/bin/env bash
# Works through what evals/ledger/STATUS.md lists as not passing, one item at a time, and survives the
# account's usage windows: after every item it refreshes STATUS.md and commits and pushes it with the new
# ledger rows; on the first refused run it reads the reset time, pushes STATUS.md marked "paused until",
# waits, and resumes with only what is still to run. Nothing that already passes is re-run.
#
#   setsid nohup bash tests/run-pending.sh <agent-model> <judge-model> > run-pending.log 2>&1 &
#
# An item that fails twice in one invocation is set aside (listed in STATUS.md) for a person to triage.
set -u
cd "$(dirname "$0")/.."
AGENT=${1:-claude-opus-5-5}
JUDGE=${2:-claude-sonnet-5-5}
BRANCH=$(git rev-parse --abbrev-ref HEAD)
LOGDIR=${RUN_PENDING_LOGS:-${TMPDIR:-/tmp}/run-pending}
mkdir -p "$LOGDIR"
declare -A FAILS
SKIPPED=""

publish() { # $1 = note for STATUS.md
  node tests/ledger-status.mjs --note "$1" >/dev/null
  git add evals/ledger/ledger.jsonl evals/ledger/STATUS.md
  git -c user.name="${GIT_AUTHOR_NAME:-Robert Lemmermann}" -c user.email="${GIT_AUTHOR_EMAIL:-robert@lemmermann.me}" commit -q -m "test(ledger): $1" \
    -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01S6yqEe1ggFm36UwTy1hFfD" 2>/dev/null || true
  for i in 1 2 3 4; do git push -q -u origin "$BRANCH" 2>/dev/null && break; sleep $((2 ** i)); done
}

wait_for_reset() { # $1 = log file holding the refusal
  local t h m ap now target
  t=$(grep -o -E 'resets [0-9]{1,2}(:[0-9]{2})?(am|pm) \(UTC\)' "$1" | tail -1)
  h=$(echo "$t" | grep -o -E '[0-9]{1,2}' | head -1); m=$(echo "$t" | grep -o -E ':[0-9]{2}' | tr -d ':'); m=${m:-0}
  ap=$(echo "$t" | grep -o -E 'am|pm')
  if [ -z "$h" ]; then target=$(( $(date -u +%s) + 3600 )); else
    [ "$ap" = pm ] && [ "$h" -lt 12 ] && h=$((h + 12)); [ "$ap" = am ] && [ "$h" -eq 12 ] && h=0
    target=$(date -u -d "$(date -u +%F) $h:$m" +%s); now=$(date -u +%s); [ "$target" -le "$now" ] && target=$((target + 86400))
  fi
  target=$((target + 180))
  publish "paused by the usage window until $(date -u -d @$target +%H:%M) UTC; resumes on its own"
  echo "$(date -u +%FT%TZ) paused until $(date -u -d @$target +%FT%TZ)"
  while [ "$(date -u +%s)" -lt "$target" ]; do sleep 60; done
}

refused() { grep -q -E "hit your .{0,20}limit|out of usage credits|model_requires_usage_credits" "$1"; }

publish "runner started"
while :; do
  PLAN=$(node tests/ledger-status.mjs --json --no-write | head -1)
  NEXT=$(echo "$PLAN" | SKIP="$SKIPPED" node -e '
    const p = JSON.parse(require("fs").readFileSync(0, "utf8")).plan; const skip = new Set((process.env.SKIP || "").split(" ").filter(Boolean));
    const c = p.cases.find((x) => !skip.has("case:" + x)); if (c) { console.log("case " + c); process.exit(0); }
    if (p.pipeline.length && !skip.has("pipeline")) { console.log("pipeline"); process.exit(0); }
    const q = p.queries.filter((x) => !skip.has("query:" + x)); if (q.length) { console.log("queries " + q.join(",")); process.exit(0); }
    const s = p.personas.find((x) => !skip.has("persona:" + x)); if (s) { console.log("persona " + s); process.exit(0); }
    console.log("none");')
  [ "$NEXT" = none ] && break
  KIND=${NEXT%% *}; ARG=${NEXT#* }
  LOG="$LOGDIR/$(date -u +%Y%m%dT%H%M%S)-$KIND.log"
  echo "$(date -u +%FT%TZ) running $NEXT"
  case "$KIND" in
    case) KEY="case:$ARG"; env -u CLAUDECODE node tests/run-evals.mjs --case "$ARG" --model "$AGENT" --judge-model "$JUDGE" -j 3 --max-cost-usd 250 > "$LOG" 2>&1 ;;
    pipeline) KEY="pipeline"; env -u CLAUDECODE node tests/live/pipeline-sim.mjs --model "$AGENT" --judge-model "$JUDGE" > "$LOG" 2>&1 ;;
    queries) KEY="queries"; env -u CLAUDECODE node tests/run-trigger-set.mjs --runs 3 --model "$AGENT" --only "$ARG" > "$LOG" 2>&1 ;;
    persona) KEY="persona:$ARG"; env -u CLAUDECODE node tests/live/interview-sim.mjs --persona "$ARG" --sim deterministic --model "$AGENT" > "$LOG" 2>&1 ;;
  esac
  if refused "$LOG"; then wait_for_reset "$LOG"; continue; fi
  STILL=$(node tests/ledger-status.mjs --json --no-write | head -1 | KIND="$KIND" ARG="$ARG" node -e '
    const p = JSON.parse(require("fs").readFileSync(0, "utf8")).plan; const k = process.env.KIND, a = process.env.ARG;
    const left = k === "case" ? p.cases.includes(a) : k === "pipeline" ? p.pipeline.length > 0 : k === "queries" ? p.queries.length > 0 : p.personas.includes(a);
    console.log(left ? "yes" : "no");')
  if [ "$STILL" = yes ]; then
    FAILS[$KEY]=$(( ${FAILS[$KEY]:-0} + 1 ))
    if [ "${FAILS[$KEY]}" -ge 2 ]; then SKIPPED="$SKIPPED $KEY"; publish "$NEXT failed twice; set aside for triage"; continue; fi
    publish "$NEXT failed once; re-running"
  else
    publish "$NEXT passing"
  fi
done
publish "runner finished${SKIPPED:+; set aside for triage:$SKIPPED}"
echo "$(date -u +%FT%TZ) finished${SKIPPED:+; set aside:$SKIPPED}"
