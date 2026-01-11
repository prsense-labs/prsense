/**
 * Input Validation Utilities
 * 
 * Enterprise-grade input validation and sanitization
 */

import { ValidationError, ConfigurationError } from './errors.js'

/**
 * Validate PR input data
 */
export function validatePRInput(pr: { prId: number; title: string; description: string; files: string[]; diff?: string }): void {
    if (!Number.isInteger(pr.prId) || pr.prId <= 0) {
        throw new ValidationError('prId must be a positive integer', 'prId')
    }

    if (typeof pr.title !== 'string' || pr.title.trim().length === 0) {
        throw new ValidationError('title must be a non-empty string', 'title')
    }

    if (pr.title.length > 500) {
        throw new ValidationError('title must be 500 characters or less', 'title')
    }

    if (typeof pr.description !== 'string') {
        throw new ValidationError('description must be a string', 'description')
    }

    if (pr.description.length > 10000) {
        throw new ValidationError('description must be 10,000 characters or less', 'description')
    }

    if (!Array.isArray(pr.files)) {
        throw new ValidationError('files must be an array', 'files')
    }

    // Empty files array is allowed (some PRs might not have files)
    // But we validate the array structure
    if (pr.files.length > 1000) {
        throw new ValidationError('files array must contain 1000 or fewer items', 'files')
    }

    for (let i = 0; i < pr.files.length; i++) {
        const file = pr.files[i]
        if (file === undefined || file === null) {
            throw new ValidationError(`files[${i}] must be defined`, `files[${i}]`)
        }
        if (typeof file !== 'string' || file.trim().length === 0) {
            throw new ValidationError(`files[${i}] must be a non-empty string`, `files[${i}]`)
        }
        if (file.length > 500) {
            throw new ValidationError(`files[${i}] must be 500 characters or less`, `files[${i}]`)
        }
    }

    if (pr.diff !== undefined) {
        if (typeof pr.diff !== 'string') {
            throw new ValidationError('diff must be a string', 'diff')
        }
        if (pr.diff.length > 500000) { // 500KB limit for diff
            throw new ValidationError('diff must be 500KB or less', 'diff')
        }
    }
}

/**
 * Validate weights array
 */
export function validateWeights(weights: [number, number, number]): void {
    if (!Array.isArray(weights) || weights.length !== 3) {
        throw new ValidationError('weights must be an array of 3 numbers', 'weights')
    }

    for (let i = 0; i < 3; i++) {
        const weight = weights[i]
        if (weight === undefined || typeof weight !== 'number' || !Number.isFinite(weight)) {
            throw new ValidationError(`weights[${i}] must be a finite number`, `weights[${i}]`)
        }
        if (weight < 0) {
            throw new ValidationError(`weights[${i}] must be non-negative`, `weights[${i}]`)
        }
    }

    const sum = weights[0] + weights[1] + weights[2]
    if (sum === 0) {
        throw new ValidationError('weights cannot all be zero', 'weights')
    }
}

/**
 * Validate thresholds
 */
export function validateThresholds(duplicateThreshold?: number, possibleThreshold?: number): void {
    if (duplicateThreshold !== undefined) {
        if (typeof duplicateThreshold !== 'number' || !Number.isFinite(duplicateThreshold)) {
            throw new ValidationError('duplicateThreshold must be a finite number', 'duplicateThreshold')
        }
        if (duplicateThreshold < 0 || duplicateThreshold > 1) {
            throw new ValidationError('duplicateThreshold must be between 0 and 1', 'duplicateThreshold')
        }
    }

    if (possibleThreshold !== undefined) {
        if (typeof possibleThreshold !== 'number' || !Number.isFinite(possibleThreshold)) {
            throw new ValidationError('possibleThreshold must be a finite number', 'possibleThreshold')
        }
        if (possibleThreshold < 0 || possibleThreshold > 1) {
            throw new ValidationError('possibleThreshold must be between 0 and 1', 'possibleThreshold')
        }
    }

    if (duplicateThreshold !== undefined && possibleThreshold !== undefined) {
        if (duplicateThreshold < possibleThreshold) {
            throw new ConfigurationError('duplicateThreshold must be >= possibleThreshold')
        }
    }
}

/**
 * Validate configuration values
 */
export function validateConfig(config: {
    bloomFilterSize?: number
    maxCandidates?: number
    cacheSize?: number
}): void {
    if (config.bloomFilterSize !== undefined) {
        if (!Number.isInteger(config.bloomFilterSize) || config.bloomFilterSize < 64 || config.bloomFilterSize > 67108864) {
            throw new ConfigurationError('bloomFilterSize must be an integer between 64 and 67108864')
        }
    }

    if (config.maxCandidates !== undefined) {
        if (!Number.isInteger(config.maxCandidates) || config.maxCandidates < 1 || config.maxCandidates > 1000) {
            throw new ConfigurationError('maxCandidates must be an integer between 1 and 1000')
        }
    }

    if (config.cacheSize !== undefined) {
        if (!Number.isInteger(config.cacheSize) || config.cacheSize < 1 || config.cacheSize > 100000) {
            throw new ConfigurationError('cacheSize must be an integer between 1 and 100000')
        }
    }
}

/**
 * Sanitize string input (basic XSS prevention)
 */
export function sanitizeString(input: string): string {
    if (typeof input !== 'string') {
        return ''
    }
    // Remove null bytes and control characters except newlines/tabs
    return input.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
}

/**
 * Sanitize file path (prevent directory traversal)
 */
export function sanitizeFilePath(filePath: string): string {
    if (typeof filePath !== 'string') {
        return ''
    }
    // Remove any null bytes and normalize path separators
    let sanitized = filePath.replace(/\x00/g, '')
    // Replace backslashes with forward slashes for consistency
    sanitized = sanitized.replace(/\\/g, '/')
    // Remove leading slashes to prevent absolute paths
    sanitized = sanitized.replace(/^\/+/, '')
    // Remove directory traversal attempts
    sanitized = sanitized.replace(/\.\.\//g, '').replace(/\.\.\\/g, '')
    return sanitized
}
