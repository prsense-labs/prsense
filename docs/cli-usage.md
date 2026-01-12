# 🖥️ CLI Usage Guide

## What is the CLI?

The **Command Line Interface** lets you check PRs for duplicates **before** submitting them.

Think of it like a **spell-checker for PRs** - run it before you submit!

---

## Installation

### Option 1: NPM (Recommended)

Install globally to use `prsense` anywhere:

```bash
npm install -g prsense
```

### Option 2: Build from Source (Advanced)

If you want to contribute or modify the code:

```bash
# 1. Clone repo
git clone https://github.com/prsense-labs/prsense
cd prsense

# 2. Install dependencies
npm install

# 3. Build
npm run build

# 4. Add OpenAI key (optional)
echo "OPENAI_API_KEY=sk-your-key" > .env
```

---

## Basic Usage

### Check a PR

```bash
# Create PR data file
cat > my-pr.json << 'EOF'
{
  "prId": 123,
  "title": "Fix authentication bug",
  "description": "Handle empty passwords correctly",
  "files": ["auth/login.ts", "auth/utils.ts"],
  "diff": "--- a/auth/login.ts\n+++ b/auth/login.ts"
}
EOF

# Check for duplicates
prsense check my-pr.json
```

**Output if duplicate:**
```
🔍 Checking PR #123: Fix authentication bug

📊 Result:
❌ DUPLICATE of PR #100
   Confidence: 94.2%
```

**Output if unique:**
```
🔍 Checking PR #123: Fix authentication bug

📊 Result:
✅ UNIQUE - No duplicates found
```

**Output if possible duplicate:**
```
🔍 Checking PR #123: Fix authentication bug

📊 Result:
⚠️  POSSIBLY similar to PR #100
   Confidence: 85.3%
```

---

## All Commands

### 1. Check for Duplicates

```bash
prsense check <pr-file.json>
```

**Example:**
```bash
prsense check my-pr.json
```

### 2. View Statistics

```bash
prsense stats
```

**Output:**
```
📊 PRSense Statistics

Total PRs indexed: 1,247
Duplicate pairs found: 89
Bloom filter size: 8192 bits
```

### 3. Get Help

```bash
prsense help
```

**Output:**
```
PRSense - Duplicate PR Detection

USAGE:
  prsense <command> [options]

COMMANDS:
  check <file>    Check if a PR is a duplicate
  stats           Show detector statistics
  help            Show this help message

EXAMPLES:
  prsense check pr.json
  prsense stats
```

---

## Real-World Examples

### Example 1: Before Opening a PR

```bash
#!/bin/bash
# pre-pr-check.sh - Run before opening PR

# Get current branch info
BRANCH=$(git branch --show-current)
TITLE=$(git log -1 --pretty=%s)
DESCRIPTION=$(git log -1 --pretty=%b)
FILES=$(git diff --name-only main | jq -R . | jq -s .)

# Create PR data
cat > /tmp/pr-check.json << EOF
{
  "prId": $(date +%s),
  "title": "$TITLE",
  "description": "$DESCRIPTION",
  "files": $FILES
}
EOF

# Check for duplicates
prsense check /tmp/pr-check.json

# Prompt user
if [ $? -eq 1 ]; then
  echo "⚠️  Possible duplicate detected!"
  echo "Continue with PR? (y/n)"
  read answer
  if [ "$answer" != "y" ]; then
    echo "PR creation cancelled."
    exit 1
  fi
fi
```

### Example 2: Git Pre-Push Hook

```bash
#!/bin/bash
# .git/hooks/pre-push

echo "🔍 Checking for duplicate PRs..."

# Extract commit info
cat > /tmp/pr-check.json << EOF
{
  "prId": $(git rev-parse --short HEAD),
  "title": "$(git log -1 --pretty=%s)",
  "description": "$(git log -1 --pretty=%b)",
  "files": $(git diff --name-only origin/main | jq -R . | jq -s .)
}
EOF

# Check
prsense check /tmp/pr-check.json

if [ $? -eq 1 ]; then
  echo "❌ Duplicate detected. Push cancelled."
  echo "Override? (yes/no)"
  read answer
  if [ "$answer" != "yes" ]; then
    exit 1
  fi
fi
```

### Example 3: CI/CD Integration

```yaml
# .github/workflows/check-duplicate.yml
name: Check for Duplicate PR

on:
  pull_request:
    types: [opened]

jobs:
  check-duplicate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install PRSense
        run: npm install -g prsense
      
      - name: Create PR data
        run: |
          cat > pr.json << EOF
          {
            "prId": ${{ github.event.pull_request.number }},
            "title": "${{ github.event.pull_request.title }}",
            "description": "${{ github.event.pull_request.body }}",
            "files": ["placeholder.ts"]
          }
          EOF
      
      - name: Check for duplicates
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          prsense check pr.json || echo "⚠️ Possible duplicate"
```

---

## PR File Format

### Minimal (Required Fields)

```json
{
  "prId": 123,
  "title": "Fix login bug",
  "description": "Handle empty passwords",
  "files": ["auth/login.ts"]
}
```

### Full (All Fields)

```json
{
  "prId": 123,
  "title": "Fix authentication bug",
  "description": "This PR fixes a critical bug in the authentication system where empty passwords were being accepted.",
  "files": [
    "auth/login.ts",
    "auth/validation.ts",
    "tests/auth.test.ts"
  ],
  "diff": "--- a/auth/login.ts\n+++ b/auth/login.ts\n@@ -10,6 +10,9 @@\n+  if (!password || password.length === 0) {\n+    throw new Error('Password cannot be empty');\n+  }"
}
```

### Generate from Git

```bash
# Extract from current branch
cat > pr.json << EOF
{
  "prId": $(date +%s),
  "title": "$(git log -1 --pretty=%s)",
  "description": "$(git log -1 --pretty=%b)",
  "files": $(git diff --name-only main | jq -R . | jq -s .),
  "diff": "$(git diff main)"
}
EOF
```

---

## Advanced Usage

### Batch Check Multiple PRs

```bash
#!/bin/bash
# check-all-prs.sh

for pr_file in prs/*.json; do
  echo "Checking $pr_file..."
  prsense check "$pr_file"
  echo "---"
done
```

### Custom Thresholds

```bash
# Set custom thresholds in .env
cat > .env << EOF
OPENAI_API_KEY=sk-your-key
DUPLICATE_THRESHOLD=0.95    # Stricter
POSSIBLE_THRESHOLD=0.85
EOF

prsense check pr.json
```

### Use with Different Embeddings

```bash
# Use local embeddings (free)
echo "EMBEDDING_SERVICE_URL=http://localhost:8000" >> .env
# Leave OPENAI_API_KEY blank

prsense check pr.json
```

---

## Exit Codes

The CLI returns different exit codes:

- **0**: Unique (no duplicates)
- **1**: Duplicate or possible duplicate found
- **2**: Error (invalid file, missing key, etc.)

**Use in scripts:**
```bash
prsense check pr.json
if [ $? -eq 0 ]; then
  echo "✅ Safe to submit"
else
  echo "⚠️  Check results above"
fi
```

---

## Troubleshooting

### "Module not found"
```bash
npm run build  # Rebuild TypeScript
```

### "OpenAI API error"
```bash
# Check key is set
cat .env | grep OPENAI_API_KEY

# Or use local embeddings
echo "EMBEDDING_SERVICE_URL=http://localhost:8000" >> .env
```

### "Invalid JSON"
```bash
# Validate JSON file
cat pr.json | jq .

# Or use online validator
# https://jsonlint.com
```

### "File not found"
```bash
# Use absolute path
prsense check /full/path/to/pr.json

# Or relative
prsense check ../my-pr.json
```

---

## Performance

- **Check time**: ~2 seconds (with OpenAI)
- **Local embeddings**: ~5 seconds
- **Batch (100 PRs)**: ~3-10 minutes

---

## Tips & Best Practices

### ✅ DO:
- Run before every PR submission
- Check the output confidence level
- Use in pre-push hooks
- Cache results for same commit

### ❌ DON'T:
- Don't ignore high confidence (>90%) duplicates
- Don't check every single commit (only before PR)
- Don't hardcode API keys in scripts

---

## Integration Ideas

### VSCode Extension
```json
{
  "tasks": [
    {
      "label": "Check for Duplicate PR",
      "type": "shell",
      "command": "prsense check pr.json",
      "group": "test"
    }
  ]
}
```

### Make Command
```makefile
check-duplicate:
	@prsense check pr.json
```

### NPM Script
```json
{
  "scripts": {
    "pre-commit": "prsense check pr.json"
  }
}
```

---

## FAQ

**Q: Do I need to install PRSense globally?**  
A: No, you can install it locally (`npm install prsense`) or use `npx prsense` without installing.

**Q: Can I use it offline?**  
A: Yes, with local embeddings (no OpenAI needed).

**Q: Does it remember past PRs?**  
A: Yes, if you use database storage (SQLite or PostgreSQL).

**Q: Can I customize the output?**  
A: Yes, edit `bin/prsense.ts` to change formatting.

**Q: Is there a GUI version?**  
A: Not yet, but the GitHub bot provides visual feedback.

---

## Next Steps

- **For automated checks**: Set up GitHub Bot ([deployment.md](deployment.md))
- **For manual checks**: Use CLI (this guide)
- **For integration**: Use as library ([quick-start.md](quick-start.md))

---

**The CLI is production-ready!** Start using it today to catch duplicates before submission. 🚀
