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

---

## REST API Endpoints

PRSense ships an Express server (`prsense/server`) with the following endpoints. Start it with `npm start`.

### `POST /api/rules/evaluate`

Evaluates a set of custom rules against a PR's changed files.

**Request Body:**

```json
{
  "files": ["src/auth/login.ts", "src/utils/hash.ts"],
  "linesAdded": 120,
  "linesRemoved": 30,
  "author": "sarahdev"
}
```

**Response:** `RuleViolation[]`

```json
[
  { "ruleId": "security-auth-review", "description": "Changes to auth require security review", "action": "require-review" }
]
```

### `GET /api/graph/query?startId=author:sarahdev&targetType=pr`

Queries the Knowledge Graph for nodes related to a given entity.

**Query Params:**
- `startId` — Node ID (e.g. `author:sarahdev`, `file:src/auth.ts`, `pr:342`)
- `targetType` — (Optional) Filter by `pr`, `file`, or `author`
- `relation` — (Optional) Filter by `authored`, `touches`, `duplicate_of`, `related_to`

**Response:** `GraphNode[]`

### `GET /api/graph/history?type=file&name=src/auth.ts`

Shortcut to get file or author history from the graph.

**Query Params:**
- `type` — `file` or `author`
- `name` — The file path or username

**Response:** `GraphNode[]`

### `POST /api/describe`

Generates an AI-powered PR description using heuristics and historical context (no LLM required).

**Request Body:**

```json
{
  "title": "fix: resolve login race condition",
  "diff": "--- a/src/auth.ts\n+++ b/src/auth.ts\n@@ ...",
  "author": "mchen",
  "files": ["src/auth.ts"]
}
```

**Response:**

```json
{
  "description": "## Bug Fix\nResolves a race condition in the authentication flow...\n\n**Files changed:** src/auth.ts\n**Similar PRs:** #128, #342"
}
```

### `POST /api/stale`

Evaluates an array of PRs and returns staleness scores.

**Request Body:**

```json
{
  "prs": [
    { "prId": 342, "title": "OAuth2 PKCE", "author": "sarahdev", "createdAt": "2025-12-01", "updatedAt": "2026-01-15" }
  ],
  "thresholds": { "daysInactive": 14 }
}
```

**Response:** `StalePRResult[]`

```json
[
  { "prId": 342, "title": "OAuth2 PKCE", "author": "sarahdev", "daysInactive": 47, "score": 92, "suggestedAction": "close" }
]
```

---

## Webhook Endpoints (v2.0.0)

v2.0.0 adds dedicated webhook routes for GitLab and Bitbucket alongside the existing GitHub webhook.

### `POST /api/webhook` (GitHub)

Receives GitHub App webhook events (`pull_request`, `installation`, `installation_repositories`, `ping`). Verifies signature via `X-Hub-Signature-256`.

### `POST /api/webhook/gitlab`

Receives GitLab `Merge Request Hook` events. Verifies via `X-Gitlab-Token` header against `GITLAB_WEBHOOK_SECRET`.

**Processed Actions:** `open`, `update`, `reopen`

### `POST /api/webhook/bitbucket`

Receives Bitbucket Cloud webhook events via `X-Event-Key` header.

**Processed Events:** `pullrequest:created`, `pullrequest:updated`

All three webhook routes run the same detection pipeline → store results → dispatch Slack/Discord notifications.

---

## Library Classes

### `RulesEngine`

```typescript
import { RulesEngine } from 'prsense'

const engine = new RulesEngine()
engine.addRule({
  id: 'block-auth-changes',
  description: 'Auth changes require security review',
  action: 'require-review',
  condition: { type: 'path', pattern: '**/auth/**' }
})

const violations = engine.evaluate({
  files: ['src/auth/login.ts'],
  linesAdded: 50, linesRemoved: 10
})
```

### `KnowledgeGraph`

```typescript
import { KnowledgeGraph } from 'prsense'

const graph = new KnowledgeGraph()
graph.addPR(342, 'OAuth2 PKCE', 'sarahdev', ['src/auth/oauth.ts'])

const history = graph.getFileHistory('src/auth/oauth.ts')
const authored = graph.getAuthorHistory('sarahdev')
```

### `DescriptionGenerator`

```typescript
import { DescriptionGenerator } from 'prsense'

const generator = new DescriptionGenerator(detector)
const description = await generator.generate({
  title: 'fix: login race condition',
  diff: diffString,
  author: 'mchen',
  files: ['src/auth.ts']
})
```

### `StalePRDetector`

```typescript
import { StalePRDetector } from 'prsense'

const detector = new StalePRDetector({ daysBeforeStale: 14 })
const results = detector.evaluate([
  { prId: 342, title: 'OAuth2 PKCE', author: 'sarahdev',
    createdAt: '2025-12-01', updatedAt: '2026-01-15' }
])
```
