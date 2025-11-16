# Agent Documentation

This document provides information for AI agents and automated tools working with this codebase.

## Repository Overview

This is a **Turborepo monorepo** containing a Multi-Party EdDSA (Ed25519) threshold signature implementation. The repository uses:
- **Bun** as the primary package manager (with npm/yarn/pnpm support)
- **Turborepo** for task orchestration and caching
- **TypeScript** for the client library
- **Rust** for the core cryptographic implementation
- **NAPI-RS** for Node.js native bindings

## Project Structure

```
.
├── apps/
│   ├── eddsa-core/          # Rust core library (GPL-3.0)
│   ├── eddsa-bindings/       # NAPI-RS Node.js bindings (GPL-3.0)
│   ├── eddsa-client/         # TypeScript client library (MIT)
│   └── eddsa-examples/       # Example implementations (MIT)
├── packages/
│   ├── typescript-config/    # Shared TypeScript configs
│   └── eslint-config/        # Shared ESLint configs
├── turbo.json                # Turborepo configuration
└── package.json              # Root workspace config
```

## Key Files and Their Purposes

### Configuration Files

- **`package.json`** (root): Workspace configuration, root scripts, Turborepo setup
- **`turbo.json`**: Turborepo task definitions, dependencies, caching rules
- **`bun.lock`**: Dependency lock file (Bun format)
- **`.gitignore`**: Git ignore patterns (excludes `target/`, `*.node`, `dist/`, etc.)

### Package-Specific Files

#### `eddsa-client/`
- **`package.json`**: Client library package definition, scripts, dependencies
- **`tsconfig.json`**: TypeScript configuration (extends shared config)
- **`eslint.config.mjs`**: ESLint configuration (extends shared config)
- **`jest.config.js`**: Jest test configuration
- **`src/index.ts`**: Main entry point, exports all public APIs
- **`src/client/mpc_client.ts`**: Low-level MPC client
- **`src/services/mpc_service.ts`**: MPCService implementation
- **`src/services/coordinator_service.ts`**: CoordinatorService implementation

#### `eddsa-bindings/`
- **`package.json`**: Bindings package definition, NAPI configuration
- **`Cargo.toml`**: Rust package configuration, dependencies
- **`src/lib.rs`**: NAPI-RS bindings code
- **`build.rs`**: Rust build script
- **`index.js`**: Generated JavaScript wrapper
- **`index.d.ts`**: Generated TypeScript definitions

#### `eddsa-core/`
- **`Cargo.toml`**: Rust package configuration
- **`src/lib.rs`**: Library entry point
- **`src/protocols/thresholdsig/`**: Threshold signature implementation

#### `eddsa-examples/`
- **`package.json`**: Examples package definition
- **`examples/complete_mpc_protocol.ts`**: Full MPC protocol example
- **`examples/solana_transaction_poc.ts`**: Solana transaction signing example

## Build System

### Task Dependencies (Turborepo)

Tasks are defined in `turbo.json` with dependencies:
- `build`: Depends on `^build` (build dependencies first)
- `test`: Depends on `^build` (build before testing)
- `lint`: Depends on `^lint` (lint dependencies first)
- `check-types`: Depends on `^check-types` (type check dependencies first)

### Build Order

1. **eddsa-core**: Rust library (no dependencies)
2. **eddsa-bindings**: NAPI bindings (depends on eddsa-core)
3. **eddsa-client**: TypeScript client (depends on eddsa-bindings)
4. **eddsa-examples**: Examples (depends on eddsa-client)

## Available Commands

### Root-Level Commands

All commands should be run from the root directory:

```bash
# Build all packages
bun run build

# Run all tests
bun run test

# Lint all packages
bun run lint

# Type check all packages
bun run check-types

# Format code
bun run format

# Clean all build artifacts
bun run clean
```

### Package-Specific Commands

Use `--filter` to run commands for specific packages:

```bash
# Build specific package
bun run build --filter=eddsa-client

# Test specific package
bun run test --filter=eddsa-client
```

### Package Scripts

Each package has its own scripts (see individual `package.json` files):

- **eddsa-client**: `build`, `watch`, `test`, `test:watch`, `test:coverage`, `lint`, `check-types`, `clean`
- **eddsa-bindings**: `build`, `build:debug`
- **eddsa-examples**: `example:mpc`, `example:solana`

## Dependencies

### Workspace Dependencies

- `eddsa-client` depends on `multi-party-eddsa-node` (eddsa-bindings)
- `eddsa-bindings` depends on `multi-party-eddsa` (eddsa-core) via Cargo path dependency
- `eddsa-examples` depends on `multi-party-eddsa` (eddsa-client)

### External Dependencies

- **TypeScript**: ^5.9.3
- **Jest**: ^30.2.0 (for testing)
- **ESLint**: ^9.39.1 (for linting)
- **@solana/web3.js**: ^1.98.4 (for Solana examples)
- **@napi-rs/cli**: ^2.0.0 (for building native bindings)

## Code Patterns and Conventions

### TypeScript

- **Strict Mode**: Enabled in `tsconfig.json`
- **Module System**: CommonJS for compatibility
- **Error Handling**: Custom error classes (`ValidationError`, `PartyError`, `StateError`, `ProtocolError`)
- **Null Safety**: Extensive null/undefined checks for array access

### Rust

- **Edition**: 2021
- **Crate Type**: `cdylib` for NAPI bindings, `rlib` for core library
- **Dependencies**: Managed via `Cargo.toml`

### File Naming

- TypeScript: `kebab-case.ts` for files, `PascalCase` for classes
- Rust: `snake_case.rs` for files, `PascalCase` for types

## Important Notes for Agents

### When Making Changes

1. **Build Order**: Always build dependencies first (core → bindings → client)
2. **Type Safety**: Run `check-types` after TypeScript changes
3. **Testing**: Run tests after making changes: `bun run test`
4. **Linting**: Run linting: `bun run lint`
5. **Examples**: Test examples still work after changes

### When Adding Features

1. **Update Types**: Add TypeScript types in `eddsa-client/src/types/`
2. **Update Errors**: Add error classes in `eddsa-client/src/errors/`
3. **Update Tests**: Add tests in `eddsa-client/tests/`
4. **Update Docs**: Update relevant README files
5. **Update Examples**: Update examples if API changes

### When Fixing Bugs

1. **Reproduce**: Create a test case that reproduces the bug
2. **Fix**: Make the minimal change to fix the issue
3. **Test**: Ensure all tests pass
4. **Verify**: Run examples to ensure nothing broke

### Build Artifacts

**Never commit:**
- `target/` directories (Rust build artifacts)
- `*.node` files (native bindings)
- `dist/` directories (TypeScript output)
- `node_modules/` directories
- `coverage/` directories (test coverage)

These are all in `.gitignore` and should not be tracked.

### Git History

The repository has been cleaned of large build artifacts from history. When committing:
- Only commit source code and configuration files
- Never commit build artifacts
- Use clear, descriptive commit messages
- Keep commits focused and minimal

## Testing Strategy

### Unit Tests

- Location: `eddsa-client/tests/`
- Framework: Jest
- Coverage: Aim for high coverage of core functionality

### Integration Tests

- Location: `eddsa-client/tests/mpc_integration.test.ts`
- Purpose: Test complete protocol flows

### Rust Tests

- Location: `eddsa-core/src/protocols/thresholdsig/test.rs`
- Framework: Rust's built-in test framework
- Run: `cargo test` from `eddsa-core/`

## Common Tasks

### Adding a New Package

1. Create directory in `apps/` or `packages/`
2. Add `package.json` with workspace configuration
3. Add to root `package.json` workspaces array
4. Add tasks to `turbo.json` if needed
5. Update root README

### Updating Dependencies

1. Update `package.json` in relevant package
2. Run `bun install` from root
3. Test that everything still works
4. Commit `package.json` and `bun.lock`

### Debugging Build Issues

1. Check build order: `bun run build --filter=eddsa-core` first
2. Check Rust installation: `rustc --version`
3. Check Node.js version: `node --version` (should be >= 18)
4. Clean and rebuild: `bun run clean && bun run build`

## Environment Variables

Currently, no environment variables are required. For future development:
- Consider adding `.env.example` files if needed
- Document any required environment variables in README files

## CI/CD Considerations

If setting up CI/CD:
1. Install Rust toolchain
2. Install Node.js >= 18
3. Install Bun (or use npm/yarn/pnpm)
4. Run: `bun install && bun run build && bun run test`
5. Consider using Turborepo remote caching

## Security Notes

- **Private Keys**: Never log or expose private keys
- **Secret Shares**: Handle secret shares securely
- **Network Communication**: In production, use HTTPS for all communication
- **Input Validation**: Always validate inputs before cryptographic operations

## License Information

- **eddsa-core**: GPL-3.0
- **eddsa-bindings**: GPL-3.0
- **eddsa-client**: MIT
- **eddsa-examples**: MIT

Be aware of license compatibility when using these packages.

## Additional Resources

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [NAPI-RS Documentation](https://napi.rs/)
- [Rust Documentation](https://doc.rust-lang.org/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

## Questions or Issues

If you encounter issues or have questions:
1. Check the relevant README file
2. Review example implementations
3. Check test files for usage patterns
4. Review git history for similar changes

