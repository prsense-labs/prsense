/**
 * PRSense Library Entry Point
 */

export * from './types.js'
export * from './prsense.js'
export * from './embedders/openai.js'
export * from './embedders/local.js'
export * from './embedders/onnx.js'
export * from './storage/memory.js'
export * from './storage/interface.js'
export * from './storage/file.js'
export * from './storage/sqlite.js'
export * from './storage/postgres.js'
export * from './similarity.js'
export * from './jaccard.js'
export * from './ranker.js'
export * from './thresholds.js'
export * from './bloomFilter.js'
export * from './attributionGraph.js'
export * from './embeddingPipeline.js'
export * from './candidateRetriever.js'
export * from './decisionEngine.js'
export * from './embeddingCache.js'
export * from './crossRepo.js'
export * from './validation.js'
export * from './errors.js'
export * from './triage.js'
export * from './impactScore.js'
export * from './rules.js'
export * from './knowledgeGraph.js'
export * from './descriptionGenerator.js'
export * from './stalePR.js'
export * from './notifications/index.js'
// Re-export providers (excluding PRMetadata which conflicts with ./types.ts)
export {
    type PRFiles,
    type GitProvider,
    type ProviderConfig,
    type ProviderType,
    ProviderError,
    createProvider,
    GitHubProvider,
    GitLabProvider,
    BitbucketProvider,
} from './providers/index.js'
export type { PRMetadata as ProviderPRMetadata } from './providers/index.js'
// Note: server.ts and github-bot.ts are intentionally NOT exported from root.
// Import them via 'prsense/server' and 'prsense/bot' sub-paths.