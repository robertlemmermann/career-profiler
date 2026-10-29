# Release: checks, evals, the ledger and the 100 % rule

## 1. Free checks

```bash
node tests/selftest.mjs            # every area must pass
node --test "tests/unit/*.test.mjs"
```

`metadata.version` in SKILL.md, the top entry of `CHANGELOG.md` and the README's version line
must agree; the git tag is `v<version>`.

## 2. Paid evals (every release; whenever a playbook, the description or a check changes meaning)

Pin the agent model and the judge model on every paid run (the ledger records both; a row
with `model: null` cannot be compared). Batch the shell-free cases by tag: when the cost
ceiling trips, `claude plugin eval` skips the paid graders of the runs in flight and a budget
stop reads as llm-grader failures.

```bash
M="--model <agent-model-id> --judge-model <judge-model-id>"
node tests/run-evals.mjs --tag gate $M             # step 0 in every mode: cheapest, highest value
node tests/run-evals.mjs --tag trigger $M
node tests/run-evals.mjs --tag pii --tag safety --tag storage --tag watch $M
node tests/run-evals.mjs --tag interview --tag profile $M
node tests/run-evals.mjs --tag resume --tag match $M   # the long cases (12 turns, 6-9 judge calls each)
node tests/run-evals.mjs --tag shell --scaffold --allow-tools "Bash(node *)" "Bash(cd *)" "Bash(cat *)" Read Write Edit $M   # needs bubblewrap + socat on Linux
node tests/run-trigger-set.mjs --runs 3 --model <agent-model-id>   # (--host copilot|codex where installed)
node tests/live/interview-sim.mjs --persona icu-nurse --sim deterministic --model <agent-model-id>
node tests/live/interview-sim.mjs --persona electrician-journeyman --sim deterministic --model <agent-model-id>
node tests/live/interview-sim.mjs --persona senior-swe --sim model --model <agent-model-id>
```

When every batch is green on the same sha, run the whole shell-free suite once more on that
sha (`node tests/run-evals.mjs $M`), then the shell case, the trigger set and the simulations,
so the newest ledger rows for the release sha are one coherent set. `-j <n>` runs cases in
parallel on one credential (shared rate limit).

The simulator drives Claude Code only; Copilot and Codex trigger runs use `run-trigger-set.mjs
--host copilot|codex`, whose method confidence is recorded in each ledger row.

Every runner appends rows to `evals/ledger/ledger.jsonl` (one row per case or query or
persona per run: git sha, skill version, host, model, judge model, runner, score, passed, cost,
`failure_class`). Rows are never deleted.

## 3. The 100 % rule

A version is releasable when the newest ledger rows for its sha pass every case, every trigger
query behaves as labeled, and every simulated interview passes its grade. A failing row is
classified before anything else happens: `skill` (fix the skill), `grader` (fix the grader, but
never lower the bar), `fixture` (fix the fixture), `host-flake` (re-run once; a second failure is
real), `model-drift` (pin the model and re-run). After the fix, re-run the failing case with
`--runs 5`; anything short of 5 of 5 is not a pass. Record the final run's rows and costs in `CHANGELOG.md`.

## 4. Manual matrix

`tests/manual-matrix.md`: OS × host × step; `not run` is never `pass`. Fill it per tag.
