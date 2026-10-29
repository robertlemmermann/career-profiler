#!/usr/bin/env bash
# Seeds the eval workspace: a store with the senior-swe profile and the posting as a file.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p store
cp "$here/fixtures/profile.json" store/profile.json
cp "$here/fixtures/posting.txt" posting.txt
cat > README.txt <<'EOT'
This workspace holds a career-profiler store at ./store (CAREER_PROFILER_HOME=./store, or pass --store ./store)
and a job posting at ./posting.txt.
EOT
