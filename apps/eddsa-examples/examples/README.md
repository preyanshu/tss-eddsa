# Examples

This directory contains example implementations demonstrating how to use the Multi-Party EdDSA library.

## Examples

### 1. Complete MPC Protocol (`complete_mpc_protocol.ts`)

A comprehensive example showing the full MPC protocol flow:

- **Key Generation Phase**: Party registration, commitments, share distribution, and shared keypair construction
- **Signing Phase**: Ephemeral key generation, local signature computation, and signature aggregation

**Run:**

```bash
npm run example:mpc -- 2 3 party-0,party-1
```

**Arguments:**

- `threshold` (default: 2) - Minimum parties needed to sign
- `totalParties` (default: 3) - Total number of parties
- `signingParties` (default: party-0,party-1) - Comma-separated party IDs

### 2. Solana Transaction POC (`solana_transaction_poc.ts`)

A proof-of-concept demonstrating how to sign and send Solana transactions using MPC threshold signatures.

**Prerequisites:**

```bash
# Start Solana test validator
solana-test-validator
```

**Run:**

```bash
npm run example:solana -- 2 3 party-0,party-1
```

**What it demonstrates:**

- Complete MPC protocol execution
- Converting MPC signatures to Solana's 64-byte format
- Creating Solana transfer transactions
- Signing transactions with MPC signatures
- Sending transactions to the network

## Architecture

Both examples simulate a distributed architecture where:

- Each party runs an `MPCService` on their own server
- A `CoordinatorService` orchestrates the protocol
- Services communicate via HTTP APIs (simulated in these examples)

In production, these services would run on separate servers and communicate over HTTP.
