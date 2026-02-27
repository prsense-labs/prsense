# PRSense API Reference

This guide covers the core API methods of the `PRSenseDetector` class.

## Initialization

```typescript
import { PRSenseDetector, createOpenAIEmbedder } from 'prsense'

const detector = new PRSenseDetector({
    embedder: createOpenAIEmbedder(process.env.OPENAI_API_KEY),
    duplicateThreshold: 0.90,
    possibleThreshold: 0.82
})
```

## Methods

### `check(pr: PRInput, options?: CheckOptions)`

Checks if a PR is a duplicate of any previously indexed PRs.

**Parameters:**

-   `pr`: logic object containing PR details.
    -   `prId`: Unique ID of the PR.
    -   `title`: PR title.
    -   `description`: PR description body.
    -   `files`: Array of changed file paths.
    -   `diff`: (Optional) The unified diff string.
-   `options`:
    -   `dryRun`: If true, does not add the PR to the index.

**Returns:** `DetectionResult`

```typescript
const result = await detector.check({
    prId: 123,
    title: "Fix login bug",
    description: "Fixed the issue where...",
    files: ["src/auth.ts"]
})

if (result.type === 'DUPLICATE') {
    console.log(`Duplicate of PR #${result.originalPr} (${result.confidence})`)
}
```

### `search(query: string, limit: number = 10)`

**[New in v1.0.2]**
Searches for PRs using natural language queries ("Semantic Search"). This leverages vector embeddings to find conceptually similar PRs, even if they don't share exact keywords.

**Parameters:**

-   `query`: The natural language search string.
-   `limit`: (Optional) Maximum number of results to return. Default is 10.

**Returns:** `Promise<SearchResult[]>`

```typescript
const results = await detector.search("refactor authentication middleware")

results.forEach(r => {
    console.log(`[${r.score.toFixed(2)}] #${r.prId} ${r.title}`)
})
```

### `getDuplicates(prId: number)`

Returns a list of all PR IDs that are identified as duplicates of the given PR ID.

### `getStats()`

Returns internal statistics about the detector state, such as total indexed PRs and memory usage.

## Storage Integration

To enable persistence and scalable vector search:

```typescript
import { PRSenseDetector, createPostgresStorage } from 'prsense'

const detector = new PRSenseDetector({
    embedder: ...,
    storage: createPostgresStorage({
        connectionString: process.env.DATABASE_URL
    })
})
```

When connected to Postgres with `pgvector`, the `search()` and duplicate detection will automatically use database-side vector search for scalability.
