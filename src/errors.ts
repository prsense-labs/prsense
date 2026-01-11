/**
 * PRSense Error Types
 * 
 * Standardized error types for better error handling in enterprise environments
 */

export class PRSenseError extends Error {
    constructor(message: string, public code: string) {
        super(message)
        this.name = 'PRSenseError'
        Object.setPrototypeOf(this, PRSenseError.prototype)
    }
}

export class ValidationError extends PRSenseError {
    constructor(message: string, public field?: string) {
        super(message, 'VALIDATION_ERROR')
        this.name = 'ValidationError'
        Object.setPrototypeOf(this, ValidationError.prototype)
    }
}

export class StorageError extends PRSenseError {
    constructor(message: string, public cause?: Error) {
        super(message, 'STORAGE_ERROR')
        this.name = 'StorageError'
        Object.setPrototypeOf(this, StorageError.prototype)
    }
}

export class EmbeddingError extends PRSenseError {
    constructor(message: string, public cause?: Error) {
        super(message, 'EMBEDDING_ERROR')
        this.name = 'EmbeddingError'
        Object.setPrototypeOf(this, EmbeddingError.prototype)
    }
}

export class ConfigurationError extends PRSenseError {
    constructor(message: string) {
        super(message, 'CONFIGURATION_ERROR')
        this.name = 'ConfigurationError'
        Object.setPrototypeOf(this, ConfigurationError.prototype)
    }
}
