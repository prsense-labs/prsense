# Contributing to PRSense

First off, thank you for considering contributing to PRSense! It's people like you that make building tools for the developer community such a rewarding experience.

Following these guidelines helps to communicate that you respect the time of the developers managing and developing this open source project. In return, they should reciprocate that respect in addressing your issue, assessing changes, and helping you finalize your pull requests.

## Code of Conduct

## Code of Conduct

This project is open and inclusive. Please review our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing. we expect everyone to treat others with respect and professionalism.

## Getting Started

### Prerequisites

- **Node.js**: Version 18.0.0 or higher is required.
- **Git**: For version control.

### Installation

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally:
    ```bash
    git clone https://github.com/prsense-labs/prsense.git
    cd prsense
    ```
3.  **Install dependencies**:
    ```bash
    npm install
    ```
    > **Note**: This project has optional native dependencies like `better-sqlite3` and `pg`. If you encounter issues installing these on your specific environment, they are optional for basic development but recommended for full feature testing.

## Development Workflow

### Project Structure

- `src/`: Contains the core source code for the detection engine.
- `action/`: Contains the GitHub Action wrapper and configuration.
- `bin/`: CLI entry points (`prsense`, `prsense-easy`).
- `docs/`: Project documentation.
- `examples/`: Usage examples.
- `tests/`: (If applicable) or colocated tests. (Note: PRSense uses Vitest, tests are often colocated or in `test` directory).

### Building the Project

We use TypeScript, so you need to compile the code before running it.

```bash
npm run build
```

This command runs `tsc` to compile the TypeScript files in `src/` to `dist/`.

### Running Tests

We use **Vitest** for testing.

- **Run all tests**:
    ```bash
    npm test
    ```
- **Run tests with coverage**:
    ```bash
    npm run test:coverage
    ```
- **Watch mode** (useful during development):
    ```bash
    npm run test:watch
    ```
- **UI mode** (visual test interface):
    ```bash
    npm run test:ui
    ```

### Local Execution

You can run the CLI locally to test your changes:

```bash
npm run cli -- check <path-to-pr-json>
```

Or run the demo script:

```bash
npm run demo
```

### Docker Support

If you are working on deployment features, you can build and run the Docker container:

```bash
npm run docker:build
npm run docker:run
```

## Submitting a Pull Request

1.  **Create a new branch** for your feature or bugfix:
    ```bash
    git checkout -b feature/amazing-feature
    ```
2.  **Make your changes**.
3.  **Run tests** to ensure you haven't broken existing functionality.
4.  **Update documentation** if your change affects how users interact with the tool (APIs, CLI options, configuration).
5.  **Commit your changes** with a clear and descriptive commit message.
6.  **Push your branch** to your fork:
    ```bash
    git push origin feature/amazing-feature
    ```
7.  **Open a Pull Request** against the main repository. Describe your changes detailedly and reference any related issues.

## coding Standards

- **TypeScript**: We use strict TypeScript. Please ensure `npm run build` passes without errors.
- **Style**: Try to match the existing coding style.
- **Documentation**: If you add a new feature, please add a corresponding section to the relevant documentation file in `docs/`.

## Reporting Issues

If you find a bug or have a feature request, please [open an issue](https://github.com/prsense-labs/prsense/issues).

- **Bugs**: Please include steps to reproduce, accurate descriptions of the error, and environment details (Node version, OS).
- **Feature Requests**: Describe the problem you are solving and your proposed solution.

### Security Vulnerabilities

If you discover a security vulnerability, please see our [Security Policy](SECURITY.md) for reporting instructions. Do not report security issues in public issues.

## License

By contributing code to PRSense, you agree that your contributions will be licensed under the MIT License.
