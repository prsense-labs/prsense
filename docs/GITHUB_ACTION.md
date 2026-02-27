# Using PRSense as a GitHub Action

This repository includes a GitHub Action for Repository Memory and automatic duplicate PR detection.

## Quick Setup

1. **Add the workflow file** to your repository at `.github/workflows/prsense.yml`:

```yaml
name: PRSense Repository Memory

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  check-duplicates:
    runs-on: ubuntu-latest
    name: Check for Duplicate PRs
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Run PRSense
        uses: prsense-labs/prsense@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          duplicate-threshold: '0.90'
          possible-threshold: '0.82'
          post-comment: 'true'
```

2. **Add your OpenAI API key** to repository secrets:
   - Go to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key

3. **That's it!** PRSense will now automatically check every PR for duplicates.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for API access | Yes | - |
| `openai-api-key` | OpenAI API key for embeddings | Yes | - |
| `duplicate-threshold` | Score threshold for duplicates (0.0-1.0) | No | `0.90` |
| `possible-threshold` | Score threshold for possible duplicates (0.0-1.0) | No | `0.82` |
| `post-comment` | Whether to post comments on PRs | No | `true` |
| `embedding-provider` | Embedding provider: `openai` or `onnx` | No | `openai` |

> **Tip**: Set `embedding-provider: onnx` to use free local embeddings (no API key needed).

## Outputs

| Output | Description |
|--------|-------------|
| `result` | Detection result: `DUPLICATE`, `POSSIBLE`, or `NONE` |
| `duplicates-found` | Boolean indicating if duplicates were found |
| `duplicate-count` | Number of duplicate PRs found |
| `similar-pr` | PR number of the most similar PR (if any) |

## Example: Fail CI on Duplicates

```yaml
name: PRSense with Duplicate Prevention

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  check-duplicates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Check for duplicates
        id: prsense
        uses: prsense-labs/prsense@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
      
      - name: Fail if duplicate
        if: steps.prsense.outputs.result == 'DUPLICATE'
        run: |
          echo "::error::This PR is a duplicate of #${{ steps.prsense.outputs.similar-pr }}"
          exit 1
```

## How It Works

1. **Action triggers** when a PR is opened/updated
2. **Fetches PR details** (title, description, files)
3. **Compares** against all open PRs using AI embeddings
4. **Posts a comment** if duplicates are found
5. **Sets outputs** for use in subsequent workflow steps

## Comment Examples

### Duplicate Detected
```markdown
🚨 PRSense: Duplicate Detected

This pull request appears to be a duplicate of PR #123.

Similarity Score: 0.945 (threshold: 0.90)

📊 Breakdown:
- Text Similarity: 92.3%
- Diff Similarity: 88.1%
- File Overlap: 85.0%
```

### Possible Duplicate
```markdown
⚠️ PRSense: Possible Duplicate

This pull request may be similar to PR #456.

Similarity Score: 0.867 (threshold: 0.82)

📊 Breakdown:
- Text Similarity: 78.5%
- Diff Similarity: 82.3%
- File Overlap: 90.5%
```

## Cost Estimation

PRSense uses OpenAI's embedding API. Typical costs:
- **Small PR** (~100 lines): ~$0.0001
- **Medium PR** (~500 lines): ~$0.0005
- **Large PR** (~2000 lines): ~$0.002

For a repository with 50 PRs/month, expect ~$0.10/month in API costs.

**Free Alternative**: Use `embedding-provider: onnx` to avoid API costs entirely. See [features.md](features.md#feature-7-onnx-local-embedder-) for details.

## Troubleshooting

**Action fails with "This action only works on pull_request events"**
- Ensure the workflow is triggered by `pull_request` events

**No comments posted**
- Check that `post-comment` is set to `'true'`
- Verify `GITHUB_TOKEN` has write permissions

**Rate limiting**
- OpenAI API has generous rate limits
- GitHub API rate limit is 1000 requests/hour for GITHUB_TOKEN

## Development

To use this action in your own repository:

```yaml
- uses: prsense-labs/prsense@v1
```

To use a local copy (for development):

```yaml
- uses: ./
```
