#!/usr/bin/env bash
# Generate src/node/services/agentSkills/builtInSkillContent.generated.ts

set -euo pipefail

if command -v bun >/dev/null 2>&1; then
  bun scripts/gen_builtin_skills.ts
else
  npx tsx scripts/gen_builtin_skills.ts
fi

echo "Generated src/node/services/agentSkills/builtInSkillContent.generated.ts"
