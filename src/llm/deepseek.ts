/**
 * DeepSeek LLM Provider

 */

import type { LLMProvider } from '../rag/queryEngine.js'

export interface DeepSeekConfig {
    /** DeepSeek API key (starts with sk-) */
    apiKey: string
    /** Model to use for chat completions @default 'deepseek-chat' */
    model?: string
    /** Base URL for the DeepSeek API @default 'https://api.deepseek.com' */
    baseUrl?: string
    /** Temperature for generation @default 0.2 */
    temperature?: number
}

interface DeepSeekChatResponse {
    choices: Array<{
        message: {
            content: string
        }
    }>
    usage?: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
    }
}

interface DeepSeekError {
    error: {
        message: string
        type: string
        code?: string
    }
}

/**
 * DeepSeek LLM provider for affordable AI-powered features.
 * Implements the LLMProvider interface used by RAGQueryEngine and DescriptionGenerator.
 */
export class DeepSeekProvider implements LLMProvider {
    private apiKey: string
    private model: string
    private baseUrl: string
    private temperature: number

    constructor(config: DeepSeekConfig) {
        if (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim().length === 0) {
            throw new Error('DeepSeek API key is required')
        }

        this.apiKey = config.apiKey.trim()
        this.model = config.model || 'deepseek-chat'
        this.baseUrl = (config.baseUrl || 'https://api.deepseek.com').replace(/\/$/, '')
        this.temperature = config.temperature ?? 0.2
    }

    /**
     * Generate text using DeepSeek's chat completions API.
     * Compatible with the LLMProvider interface used across PRSense.
     */
    async generate(prompt: string): Promise<string> {
        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 60000) // 60s timeout

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'user', content: prompt }
                    ],
                    temperature: this.temperature
                }),
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
                let errorMessage = `DeepSeek API error: ${response.status} ${response.statusText}`
                try {
                    const errorData = await response.json() as DeepSeekError
                    if (errorData.error?.message) {
                        errorMessage = `DeepSeek API error: ${errorData.error.message}`
                    }
                } catch {
                    // If error parsing fails, use default message
                }
                throw new Error(errorMessage)
            }

            const data = await response.json() as DeepSeekChatResponse

            if (!data.choices || data.choices.length === 0) {
                throw new Error('Empty response from DeepSeek API')
            }

            return data.choices?.[0]?.message?.content || ''
        } catch (error) {
            if ((error as Error).name === 'AbortError') {
                throw new Error('DeepSeek API request timeout after 60s')
            }
            throw error
        }
    }

    /**
     * Chat completion with system + user messages.
     * Useful for structured prompts (triage, decision extraction).
     */
    async chatCompletion(systemPrompt: string, userQuery: string): Promise<string> {
        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 60000)

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userQuery }
                    ],
                    temperature: this.temperature
                }),
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
                let errorMessage = `DeepSeek API error: ${response.status} ${response.statusText}`
                try {
                    const errorData = await response.json() as DeepSeekError
                    if (errorData.error?.message) {
                        errorMessage = `DeepSeek API error: ${errorData.error.message}`
                    }
                } catch {
                    // If error parsing fails, use default message
                }
                throw new Error(errorMessage)
            }

            const data = await response.json() as DeepSeekChatResponse
            return data.choices?.[0]?.message?.content || ''
        } catch (error) {
            if ((error as Error).name === 'AbortError') {
                throw new Error('DeepSeek API request timeout after 60s')
            }
            throw error
        }
    }

    /**
     * JSON-mode chat completion for structured extraction (e.g., triage, decisions).
     */
    async jsonCompletion(systemPrompt: string, userQuery: string): Promise<string> {
        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 60000)

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userQuery }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.1
                }),
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
                throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`)
            }

            const data = await response.json() as DeepSeekChatResponse
            return data.choices?.[0]?.message?.content || '{}'
        } catch (error) {
            if ((error as Error).name === 'AbortError') {
                throw new Error('DeepSeek API request timeout after 60s')
            }
            throw error
        }
    }
}

/**
 * Create DeepSeek provider from environment variable
 */
export function createDeepSeekProvider(): DeepSeekProvider {
    const apiKey = process.env.DEEPSEEK_API_KEY

    if (!apiKey) {
        throw new Error(
            'DEEPSEEK_API_KEY environment variable is required. ' +
            'Get your key at: https://platform.deepseek.com/api_keys'
        )
    }

    return new DeepSeekProvider({
        apiKey,
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat'
    })
}
