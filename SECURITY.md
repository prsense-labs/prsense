# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Security Features

### Input Validation
PRSense implements comprehensive input validation to prevent malicious inputs:

- **Type Validation**: All inputs are type-checked
- **Size Limits**: 
  - Title: max 500 characters
  - Description: max 10,000 characters
  - Files: max 1000 files
  - Diff: max 500KB
- **Format Validation**: PR IDs must be positive integers
- **Array Validation**: Files array structure validated

### Input Sanitization
All user inputs are sanitized before processing:

- **String Sanitization**: Removes null bytes and control characters
- **Path Sanitization**: Prevents directory traversal attacks
- **XSS Prevention**: Removes potentially dangerous characters

### Error Handling
- Errors don't expose sensitive information
- API keys never logged or included in error messages
- Stack traces not exposed to end users
- Graceful degradation on failures

### Storage Security
- **SQL Injection Prevention**: Parameterized queries in all storage backends
- **Connection Security**: Database credentials handled securely
- **Error Messages**: Don't leak database structure

### API Security
- **Timeouts**: All external API calls have timeouts (30s default)
- **Rate Limiting**: Batch operations limited to 1000 PRs
- **Request Validation**: All requests validated before processing

## Data Privacy & Compliance

We take data privacy seriously. When using the default OpenAI embedder:

- **What WE send**:
  - PR Title and Description
  - Diff snippets (only lines added/removed)
  - File paths
- **What we DO NOT send**:
  - Full source code
  - Repository history
  - Secrets or Environment variables
  - Personally Identifiable Information (PII)

**Privacy-First Alternative**:
For strict data privacy, use the **ONNX Embedder** (Feature 7) to run 100% offline. No data leaves your infrastructure.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it to:
- **Email**: security@prsense.dev
- **GitHub**: Create a private security advisory

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will respond within 48 hours and work with you to resolve the issue.

## Security Best Practices

### For Users

1. **API Keys**: Store API keys in environment variables, never in code
2. **Database Credentials**: Use secure connection strings
3. **Input Validation**: Always validate inputs before passing to PRSense
4. **Error Handling**: Don't expose error details to end users
5. **Updates**: Keep PRSense updated to latest version

### For Developers

1. **Dependencies**: Regularly update dependencies
2. **Testing**: Run security tests before deployment
3. **Monitoring**: Monitor for unusual activity
4. **Logging**: Don't log sensitive information
5. **Access Control**: Restrict access to storage backends

### CI/CD Security (GitHub Actions)

When deploying PRSense as a GitHub Action:

1. **Least Privilege**: Grant only necessary permissions to the `GITHUB_TOKEN`.
   ```yaml
   permissions:
     contents: read
     pull-requests: write
     issues: write
   ```
2. **Pin Actions**: Use a specific commit hash or version tag to prevent supply chain attacks.
   ```yaml
   uses: prsense-labs/prsense@v1.0.2 # Recommended
   ```
3. **Secrets**: Store `OPENAI_API_KEY` in GitHub Secrets, never in plain text.

## Known Security Considerations

### Optional Dependencies
Some features require optional dependencies:
- `better-sqlite3`: For SQLite storage
- `pg`: For PostgreSQL storage
- `onnxruntime-node`: For ONNX embeddings

These are marked as optional and won't be installed by default. Only install what you need.

### External API Calls
When using OpenAI embedder:
- API keys are sent to OpenAI servers
- Consider using ONNX embedder for privacy-sensitive deployments
- Monitor API usage to prevent unexpected costs

### Storage Backends
- SQLite: File-based, ensure proper file permissions
- PostgreSQL: Use secure connection strings, enable SSL in production
- In-memory: Data lost on restart, not suitable for production

## Security Updates

Security updates will be released as patch versions (e.g., 1.0.1, 1.0.2).

Subscribe to security advisories:
- GitHub: Watch repository for security alerts
- npm: Check package for security vulnerabilities

---

| 1.0.x   | :white_check_mark: |
| 1.0.2   | :white_check_mark: |

...

**Last Updated**: 2026-02-14
**Security Contact**: security@prsense.dev
