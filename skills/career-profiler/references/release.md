# Release: checks, evals, the ledger and the 100 % rule

## 1. Free checks

```bash
node tests/selftest.mjs            # every area must pass
node --test "tests/unit/*.test.mjs"
```

`metadata.version` in SKILL.md, the top entry of `CHANGELOG.md` and the README's version line
must agree; the git tag is `v<version>`.

## 2. Paid evals (every release; whenever a playbook, the description or a check changes meaning)

```bash
node tests/run-evals.mjs                          # claude plugin eval, threshold 1, sonnet judge, shell-free cases
node tests/run-evals.mjs --tag shell --scaffold --allow-tools Bash Write Edit   # the shell cases, needs the OS sandbox
node tests/run-trigger-set.mjs --runs 3           # trigger set on Claude Code (--host copilot|codex where installed)
node tests/live/interview-sim.mjs --persona icu-nurse --sim deterministic
node tests/live/interview-sim.mjs --persona electrician-journeyman --sim deterministic
node tests/live/interview-sim.mjs --persona senior-swe --sim model
```

Every runner appends rows to `evals/ledger/ledger.jsonl` (one row per case or query or
persona per run: git sha, skill version, host, model, judge model, runner, score, passed, cost,
`failure_class`). Rows are never deleted.

## 3. The 100 % rule

A version is releasable when the newest ledger rows for its sha pass every case, every trigger
query behaves as labeled, and every simulated interview passes its grade. A failing row is
classified before anything else happens: `skill` (fix the skill), `grader` (fix the grader, but
never lower the bar), `fixture` (fix the fixture), `host-flake` (re-run once; a second failure is
real), `model-drift` (pin the model and re-run). After the fix, re-run the failing case with
`--runs 3`; a 2-of-3 pass is not a pass. Record the final run's rows and costs in `CHANGELOG.md`.

## 4. Manual matrix

`tests/manual-matrix.md`: OS × host × step; `not run` is never `pass`. Fill it per tag.
