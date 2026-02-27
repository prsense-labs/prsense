/**
 * Example: Simple API Server using PRSense as a library
 * 
 * Shows how easy it is to integrate PRSense into your own app!
 */

import express from 'express'
import { PRSenseDetector, type DetailedDetectionResult } from '../src/prsense.js'
import { createOpenAIEmbedder } from '../src/embedders/openai.js'

const app = express()
app.use(express.json())

// Create detector once (reuse for all requests)
const detector = new PRSenseDetector({
  embedder: createOpenAIEmbedder(),
  duplicateThreshold: 0.90,
  possibleThreshold: 0.82
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: Date.now() })
})

// Main endpoint - check for duplicates
app.post('/check', async (req, res) => {
  try {
    const { title, description, files, detailed, dryRun } = req.body

    // Validate input
    if (!title) {
      return res.status(400).json({ error: 'Title is required' })
    }

    // Check for duplicates (Feature 2: detailed breakdown, Feature 6: dry-run)
    let result: DetailedDetectionResult | Awaited<ReturnType<typeof detector.check>>

    if (detailed) {
      result = await detector.checkDetailed({
        prId: Date.now(),
        title,
        description: description || '',
        files: files || []
      }, { dryRun: dryRun === true })
    } else {
      result = await detector.check({
        prId: Date.now(),
        title,
        description: description || '',
        files: files || []
      }, { dryRun: dryRun === true })
    }

    // Return result with optional breakdown
    const response: any = {
      duplicate: result.type === 'DUPLICATE',
      possible: result.type === 'POSSIBLE',
      unique: result.type === 'UNIQUE',
      originalPr: result.type !== 'UNIQUE' ? result.originalPr : null,
      confidence: (result.confidence * 100).toFixed(1) + '%'
    }

    // Include breakdown if detailed (Feature 2)
    if (detailed && 'breakdown' in result && result.breakdown) {
      response.breakdown = {
        textSimilarity: result.breakdown.textSimilarity.toFixed(3),
        diffSimilarity: result.breakdown.diffSimilarity.toFixed(3),
        fileSimilarity: result.breakdown.fileSimilarity.toFixed(3),
        finalScore: result.breakdown.finalScore.toFixed(3),
        weights: result.breakdown.weights
      }
    }

    res.json(response)

  } catch (error: any) {
    console.error('Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Feature 3: Batch check endpoint
app.post('/check/batch', async (req, res) => {
  try {
    const { prs } = req.body

    if (!Array.isArray(prs) || prs.length === 0) {
      return res.status(400).json({ error: 'prs array is required' })
    }

    const results = await detector.checkMany(prs)

    res.json({
      count: results.length,
      results: results.map(r => ({
        prId: r.prId,
        type: r.result.type,
        confidence: (r.result.confidence * 100).toFixed(1) + '%',
        originalPr: r.result.type !== 'UNIQUE' ? r.result.originalPr : null,
        processingTimeMs: r.processingTimeMs
      }))
    })

  } catch (error: any) {
    console.error('Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Feature 5: Update weights endpoint
app.post('/weights', (req, res) => {
  try {
    const { text, diff, file } = req.body

    if (text === undefined || diff === undefined || file === undefined) {
      return res.status(400).json({ error: 'text, diff, and file weights are required' })
    }

    detector.setWeights([text, diff, file])
    const currentWeights = detector.getWeights()

    res.json({
      success: true,
      weights: currentWeights
    })

  } catch (error: any) {
    console.error('Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get current weights
app.get('/weights', (req, res) => {
  const weights = detector.getWeights()
  res.json({ weights })
})

// Get statistics
app.get('/stats', (req, res) => {
  const stats = detector.getStats()
  res.json(stats)
})

// Start server
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`✅ PRSense Repository Memory API running on port ${PORT}`)
  console.log(` Endpoints:`)
  console.log(`   GET  /health      - Health check`)
  console.log(`   POST /check       - Check for duplicates`)
  console.log(`   POST /check/batch - Batch check (Feature 3)`)
  console.log(`   GET  /stats       - Get statistics`)
  console.log(`   GET  /weights     - Get current weights`)
  console.log(`   POST /weights     - Update weights (Feature 5)`)
  console.log(`\n Examples:`)
  console.log(`   # Basic check`)
  console.log(`   curl -X POST http://localhost:${PORT}/check \\`)
  console.log(`     -H "Content-Type: application/json" \\`)
  console.log(`     -d '{"title":"Fix bug","files":["auth.ts"]}'`)
  console.log(`\n   # Detailed breakdown (Feature 2)`)
  console.log(`   curl -X POST http://localhost:${PORT}/check \\`)
  console.log(`     -H "Content-Type: application/json" \\`)
  console.log(`     -d '{"title":"Fix bug","files":["auth.ts"],"detailed":true}'`)
  console.log(`\n   # Batch check (Feature 3)`)
  console.log(`   curl -X POST http://localhost:${PORT}/check/batch \\`)
  console.log(`     -H "Content-Type: application/json" \\`)
  console.log(`     -d '{"prs":[{"prId":1,"title":"Fix A"},{"prId":2,"title":"Fix B"}]}'`)
})
