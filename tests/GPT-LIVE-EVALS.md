# GPT live evals

The Codex CLI runner uses the merged suite's 38 cases (three attempts each), 32 trigger
queries (three attempts each), shell pipeline (two attempts), and three deterministic
multi-turn interviews: **74 items, 215 required attempts**. Every required attempt must
pass. This is a distinct `codex-cli` host gate, not a claim about ChatGPT Work or Claude Code.

## Start or resume

Use a persistent machine with Node 22+, Git, and a signed-in Codex CLI. Confirm `codex login
status`, a writable Codex home, and a functioning workspace-write sandbox. Authentication
stays outside the repository. The initial default is `gpt-6-astra` with high reasoning;
model availability must be established by a real run on that account.

```sh
# Inspect the queue without calling a model.
node tests/run-gpt-evals.mjs --report
# First live smoke case; rerunning the identical command resumes unfinished work.
node tests/run-gpt-evals.mjs --only case/resume-without-posting
# Full queue, waiting through quota windows; optionally publish every completed turn.
node tests/run-gpt-evals.mjs --watch --publish
# Strict release gate: exit 1 until every required attempt passes.
node tests/run-gpt-evals.mjs --release
```

`--model` and `--effort` select separate ledgers. Pin both for a campaign. `--timeout-s`
(default 900) bounds each agent/judge invocation. `--max-attempts` (default 2) limits
behavioral failures per required attempt and input hash. `--only kind/item` narrows work;
it never narrows the release denominator. Exit 0 means the full suite passed, 1 means
triage/incomplete suite, and 4 means quota, interruption, authentication or infrastructure.

For a persistent Linux host, run the command under a service manager, or:

```sh
nohup node tests/run-gpt-evals.mjs --watch --publish > gpt-evals.log 2>&1 < /dev/null &
```

A machine restart needs a service manager to relaunch that same command. A chat turn or
an ephemeral workspace is not a persistent execution host. The runner never changes
sandbox policy to bypass host restrictions and never copies credentials into checkpoints.

## Recovery and evidence

Evidence lives under `evals/ledger/codex/<model>/<effort>/`. `STATUS.json` lists every required
attempt; `runner/state.json` identifies the current turn, blocker and quota retry time.
The exclusive lock prevents concurrent supervisors for a profile. Each turn saves synthetic
workspace files, conversation, consulted skill documents, script calls, session identity and
CLI completion provenance. CLI token usage is recorded in invocation journals; dollar cost
remains unknown, not zero. Logs redact common token forms, and children inherit an allowlist
of environment variables. Review evidence before publishing when using non-synthetic inputs.

The candidate is deterministic; the agent does not receive persona ground truth. Semantic
judges use separate CLI sessions, the original rubric text, structured output, and no tools
by instruction. Pipeline judgments require three independent judges and a majority per
criterion. The bridge measures explicit skill-document consultation, not the native Claude
Skill tool. Workspace-write controls writes; these prompts are not a security boundary
against malicious agents reading host files. Use a dedicated eval account and host.

After an interruption, the runner resumes the exact CLI session. If its session history was
lost, it starts a fresh session with the persisted conversation and restored workspace and
records both identities. A reply saved before CLI termination is acknowledged without a
second bridge submission. Missing terminal events, malformed judge output, missing identity,
wrong host/model/effort and changed inputs cannot count as passes.

Quota refusals preserve progress and wait an hour in `--watch` mode; an external scheduler
can instead rerun the command, which respects the saved retry time. Authentication and
infrastructure errors stop immediately with a durable blocker. Two behavioral failures are
set aside while the queue continues. The supervisor does **not** edit the skill to repair
behavior: a coding agent must inspect evidence, classify the failure, fix it, and restart.
Skill changes invalidate all affected attempts; rubric changes invalidate their case only.
No rubrics are weakened to improve the score.

`--publish` commits this profile's evidence and pushes the current branch. It requires
working Git push authentication. A publishing failure stops the runner instead of claiming
remote durability. It does not merge the branch or modify the Claude ledger.

## Verification

```sh
node tests/selftest.mjs
node --test 'tests/unit/*.test.mjs'
```

The Codex transport tests use an isolated fake CLI, never count as live model evidence,
and exercise refusal after a saved reply, complete workspace loss, restoration, independent
grading, and skipping previously passing attempts.
