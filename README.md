# Multi-Party EdDSA Monorepo

A production-ready monorepo for Multi-Party EdDSA threshold signature implementation, featuring a TypeScript client library, Rust core implementation, and Node.js native bindings.

## Overview

This monorepo implements a distributed threshold EdDSA (Ed25519) signature scheme using Multi-Party Computation (MPC). It enables multiple parties to collaboratively generate keys and sign messages without any single party ever having access to the complete private key.

### Key Features

- **Threshold Signatures**: Require `t` out of `n` parties to sign (e.g., 2-of-3)
- **Distributed Key Generation**: Secure key generation without a trusted dealer
- **Ed25519 Compatibility**: Full compatibility with Ed25519 signature scheme
- **Solana Integration**: Sign and send Solana transactions with MPC signatures
- **TypeScript First**: Full TypeScript support with comprehensive type definitions
- **Production Ready**: Built with Turborepo for efficient builds and caching

## Repository Structure

```
.
├── apps/
│   ├── eddsa-core/          # Core Rust implementation of MPC protocol
│   ├── eddsa-bindings/      # NAPI-RS bindings exposing Rust to Node.js
│   ├── eddsa-client/        # TypeScript client library with high-level APIs
│   └── eddsa-examples/      # Example implementations and demos
├── packages/
│   ├── typescript-config/   # Shared TypeScript configurations
│   └── eslint-config/       # Shared ESLint configurations
├── turbo.json               # Turborepo task configuration
└── package.json             # Root workspace configuration
```

### Package Descriptions

#### `eddsa-core` (Rust)
The core cryptographic implementation written in Rust. Implements:
- Threshold EdDSA signature scheme
- Distributed key generation (DKG)
- Verifiable secret sharing (VSS)
- Signature aggregation

#### `eddsa-bindings` (NAPI-RS)
Node.js native bindings built with NAPI-RS that expose the Rust core functionality to JavaScript/TypeScript. Provides low-level access to:
- Key generation phases
- Ephemeral key operations
- Signature computation and verification

#### `eddsa-client` (TypeScript)
High-level TypeScript client library providing:
- `MPCService`: Service for individual parties
- `CoordinatorService`: Service for orchestrating the protocol
- `MPCClient`: Low-level client for direct MPC operations
- Full TypeScript types and error handling

#### `eddsa-examples` (TypeScript)
Example implementations demonstrating:
- Complete MPC protocol flow
- Solana transaction signing with MPC

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.0.0
- **Bun** >= 1.2.20 (or npm/yarn/pnpm as alternative)
- **Rust** >= 1.70.0 (for building native bindings)
- **Cargo** (Rust package manager, installed with Rust)

### Optional Prerequisites

- **Solana CLI** (for running Solana examples)
- **Git** (for version control)

## Installation

Install all dependencies for the monorepo:

```bash
bun install
```

This will install dependencies for all packages in the workspace.

## Available Scripts

All scripts can be run from the root directory using Turborepo:

### Build Scripts

```bash
# Build all packages
bun run build

# Build specific package
bun run build --filter=eddsa-client
bun run build --filter=eddsa-bindings
bun run build --filter=eddsa-core
```

**What it does:**
- Compiles TypeScript to JavaScript (`eddsa-client`)
- Builds native Node.js bindings (`eddsa-bindings`)
- Compiles Rust library (`eddsa-core`)
- Respects dependency order (bindings depend on core, client depends on bindings)

### Test Scripts

```bash
# Run all tests
bun run test

# Run tests for specific package
bun run test --filter=eddsa-client

# Run tests in watch mode (eddsa-client only)
cd apps/eddsa-client && bun run test:watch

# Run tests with coverage
cd apps/eddsa-client && bun run test:coverage
```

**What it does:**
- Runs Jest test suites
- Ensures dependencies are built before testing
- Generates coverage reports

### Linting and Type Checking

```bash
# Lint all packages
bun run lint

# Type check all TypeScript packages
bun run check-types

# Format code with Prettier
bun run format
```

**What it does:**
- `lint`: Runs ESLint on all packages
- `check-types`: Type checks TypeScript without emitting files
- `format`: Formats code using Prettier

### Development Scripts

```bash
# Start development mode (watch mode for all packages)
bun run dev

# Watch mode for specific package
cd apps/eddsa-client && bun run watch
```

**What it does:**
- Watches for file changes and rebuilds automatically
- Useful for active development

### Clean Scripts

```bash
# Clean all build artifacts
bun run clean
```

**What it does:**
- Removes `dist/` directories (TypeScript output)
- Removes `target/` directories (Rust build artifacts)
- Removes `node_modules` from root and all apps
- Removes `*.node` files (native bindings)

### Example Scripts

```bash
# Run complete MPC protocol example
cd apps/eddsa-examples
bun run example:mpc

# Run Solana transaction example
cd apps/eddsa-examples
bun run example:solana
```

## Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Build All Packages

```bash
bun run build
```

### 3. Run Tests

```bash
bun run test
```

### 4. Try an Example

```bash
cd apps/eddsa-examples
bun run example:mpc
```

## Development Workflow

### Working on the TypeScript Client

1. Navigate to the client package:
   ```bash
   cd apps/eddsa-client
   ```

2. Start watch mode:
   ```bash
   bun run watch
   ```

3. Make changes to TypeScript files in `src/`

4. Run tests:
   ```bash
   bun run test:watch
   ```

### Working on Native Bindings

1. Navigate to the bindings package:
   ```bash
   cd apps/eddsa-bindings
   ```

2. Build in debug mode:
   ```bash
   bun run build:debug
   ```

3. For release builds:
   ```bash
   bun run build
   ```

### Working on Rust Core

1. Navigate to the core package:
   ```bash
   cd apps/eddsa-core
   ```

2. Run Rust tests:
   ```bash
   cargo test
   ```

3. Build the library:
   ```bash
   cargo build --release
   ```

## Turborepo Configuration

This monorepo uses [Turborepo](https://turbo.build/) for:
- **Task Orchestration**: Runs tasks in the correct dependency order
- **Build Caching**: Caches build outputs for faster rebuilds
- **Parallel Execution**: Runs independent tasks in parallel
- **Remote Caching**: Optional remote caching for CI/CD

### Task Dependencies

Tasks are configured in `turbo.json`:
- `build`: Depends on `^build` (build dependencies first)
- `test`: Depends on `^build` (build before testing)
- `lint`: Depends on `^lint` (lint dependencies first)
- `check-types`: Depends on `^check-types` (type check dependencies first)

### Remote Caching

To enable remote caching (optional):

```bash
# Login to Turborepo
turbo login

# Link your repository
turbo link
```

This enables sharing build caches across team members and CI/CD pipelines.

## Package Details

### Using the Client Library

Install the client package:

```bash
npm install multi-party-eddsa
```

Basic usage:

```typescript
import { MPCService, CoordinatorService } from 'multi-party-eddsa';

// Initialize services
const party0 = new MPCService('party-0');
const party1 = new MPCService('party-1');
const coordinator = new CoordinatorService();

// Start key generation (2-of-3 threshold)
coordinator.startKeyGeneration(2, 3);

// Register parties and generate keys...
// See apps/eddsa-client/README.md for full API documentation
```

### Using Native Bindings

The native bindings are used internally by the client library. For direct access:

```typescript
import * as thresholdSigModule from 'multi-party-eddsa-node';

const thresholdSig = thresholdSigModule.threshold_sig;
// Use low-level functions...
```

## Testing

### Running Tests

```bash
# All tests
bun run test

# Specific package
bun run test --filter=eddsa-client

# With coverage
cd apps/eddsa-client && bun run test:coverage
```

### Test Structure

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test complete protocol flows
- **Rust Tests**: Test core cryptographic operations

## Contributing

### Development Setup

1. Fork the repository
2. Clone your fork
3. Install dependencies: `bun install`
4. Create a feature branch
5. Make your changes
6. Run tests: `bun run test`
7. Run linting: `bun run lint`
8. Run type checking: `bun run check-types`
9. Commit and push your changes
10. Open a pull request

### Code Style

- TypeScript: Follow existing patterns, use TypeScript strict mode
- Rust: Follow Rust standard formatting (`cargo fmt`)
- Commits: Use clear, descriptive commit messages

## Troubleshooting

### Build Issues

**Problem**: Native bindings fail to build
- **Solution**: Ensure Rust is installed (`rustc --version`)
- **Solution**: Ensure `@napi-rs/cli` is installed

**Problem**: TypeScript compilation errors
- **Solution**: Run `bun run check-types` to see all errors
- **Solution**: Ensure all dependencies are installed

### Runtime Issues

**Problem**: Cannot find native bindings module
- **Solution**: Ensure `eddsa-bindings` is built: `bun run build --filter=eddsa-bindings`
- **Solution**: Check that `*.node` files are present in `eddsa-bindings/`

## License

- **eddsa-core**: GPL-3.0 (see `apps/eddsa-core/LICENSE`)
- **eddsa-bindings**: GPL-3.0
- **eddsa-client**: MIT
- **eddsa-examples**: MIT

## Resources

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [NAPI-RS Documentation](https://napi.rs/)
- [Ed25519 RFC](https://tools.ietf.org/html/rfc8032)
- [Multi-Party Schnorr Signatures](https://github.com/KZen-networks/multi-party-schnorr)

## Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Check existing documentation in package READMEs
- Review example implementations in `apps/eddsa-examples/`
