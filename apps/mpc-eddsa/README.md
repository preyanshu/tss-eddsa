# Multi-Party EdDSA

A Node.js library for implementing threshold EdDSA (Ed25519) signatures using Multi-Party Computation (MPC). This library enables distributed key generation and threshold signing where multiple parties must collaborate to create a signature, without any single party ever having access to the complete private key.

## Features

- **Threshold Signatures**: Require `t` out of `n` parties to sign
- **Distributed Key Generation**: No single party knows the full private key
- **Multi-Party Computation**: Secure cryptographic operations across parties
- **Ed25519 Support**: Compatible with Ed25519 signature scheme
- **Solana Integration**: Sign and send Solana transactions with MPC signatures
- **TypeScript**: Full TypeScript support with type definitions

## Installation

```bash
npm install multi-party-eddsa
```

## Requirements

- Node.js >= 14.0.0
- Rust bindings for native MPC operations (included in the project)
- For Solana examples: Solana CLI tools installed

## Quick Start

### Basic Usage

```javascript
const { MPCService, CoordinatorService } = require("multi-party-eddsa");

// Step 1: Initialize services for each party
const party0 = new MPCService("party-0");
const party1 = new MPCService("party-1");
const party2 = new MPCService("party-2");

// Step 2: Create coordinator to orchestrate the protocol
const coordinator = new CoordinatorService();

// Step 3: Start key generation (threshold=2, totalParties=3)
coordinator.startKeyGeneration(2, 3);

// Step 4: Register parties
const init0 = party0.register();
const init1 = party1.register();
const init2 = party2.register();

coordinator.registerParty("party-0", init0.publicKey);
coordinator.registerParty("party-1", init1.publicKey);
coordinator.registerParty("party-2", init2.publicKey);

// Step 5: Generate commitments
const commit0 = party0.generateCommitment();
const commit1 = party1.generateCommitment();
const commit2 = party2.generateCommitment();

const commitData = coordinator.collectCommitments([
  { partyId: "party-0", ...commit0 },
  { partyId: "party-1", ...commit1 },
  { partyId: "party-2", ...commit2 },
]);

// Step 6: Distribute shares
const shares0 = party0.distributeShares(/* ... */);
const shares1 = party1.distributeShares(/* ... */);
const shares2 = party2.distributeShares(/* ... */);

// Step 7: Construct keypairs
const key0 = party0.constructKeypair(/* ... */);
const key1 = party1.constructKeypair(/* ... */);
const key2 = party2.constructKeypair(/* ... */);

const keygenResult = coordinator.collectSharedKeys([
  { partyId: "party-0", sharedKey: key0.sharedKey },
  { partyId: "party-1", sharedKey: key1.sharedKey },
  { partyId: "party-2", sharedKey: key2.sharedKey },
]);

// Now you have an aggregate public key that can be used for signing
console.log("Aggregate Public Key:", keygenResult.aggregatePublicKey);
```

## Architecture

The library follows a distributed architecture:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Party 0    │     │  Party 1    │     │  Party 2    │
│ MPCService  │     │ MPCService  │     │ MPCService  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                  ┌────────▼────────┐
                  │  Coordinator    │
                  │    Service      │
                  └─────────────────┘
```

- **MPCService**: Runs on each party's server, handles local MPC operations
- **CoordinatorService**: Orchestrates the protocol, collects and distributes data
- **MPCClient**: Low-level client for direct MPC operations (used internally)

## API Reference

### MPCService

Service that runs on each party's server.

#### Constructor

```typescript
new MPCService(partyId: string)
```

#### Methods

##### `register()`

Registers the party and generates initial public key.

```typescript
const result = service.register();
// Returns: { publicKey: SerializableBigInt }
```

##### `generateCommitment()`

Generates a commitment for the key generation phase.

```typescript
const result = service.generateCommitment();
// Returns: { commitment: SerializableBigInt, blindFactor: SerializableBigInt }
```

##### `distributeShares(threshold, shareCount, blindFactors, publicKeys, commitments, partyIndex)`

Distributes secret shares to all parties.

```typescript
const result = service.distributeShares(
  threshold: number,
  shareCount: number,
  blindFactors: SerializableBigInt[],
  publicKeys: PublicKey[],
  commitments: Commitment[],
  partyIndex: number
);
// Returns: { vss: VSSScheme, secretShares: SecretShare[] }
```

##### `constructKeypair(threshold, shareCount, publicKeys, allSecretShares, allVssSchemes, partyIndex)`

Constructs the shared keypair from collected shares.

```typescript
const result = service.constructKeypair(
  threshold: number,
  shareCount: number,
  publicKeys: PublicKey[],
  allSecretShares: SecretShare[][],
  allVssSchemes: VSSScheme[],
  partyIndex: number
);
// Returns: { sharedKey: SharedKey }
```

##### `startEphemeralKeyGeneration(message, partyIndex)`

Starts ephemeral key generation for signing.

```typescript
const result = service.startEphemeralKeyGeneration(
  message: Buffer,
  partyIndex: number
);
// Returns: { ephR: SerializableBigInt, ephKeyId: string, commitment: SerializableBigInt, blindFactor: SerializableBigInt }
```

##### `distributeEphemeralShares(ephKeyId, threshold, shareCount, ephBlindFactors, ephRPoints, ephCommitments, signingParties)`

Distributes ephemeral shares for signing.

```typescript
const result = service.distributeEphemeralShares(
  ephKeyId: string,
  threshold: number,
  shareCount: number,
  ephBlindFactors: SerializableBigInt[],
  ephRPoints: SerializableBigInt[],
  ephCommitments: Commitment[],
  signingParties: number[]
);
// Returns: { vss: VSSScheme, secretShares: SecretShare[] }
```

##### `constructEphemeralKeypair(ephKeyId, threshold, shareCount, ephRPoints, allEphSecretShares, allEphVssSchemes, partyIndex, signingParties)`

Constructs ephemeral keypair for signing.

```typescript
const result = service.constructEphemeralKeypair(
  ephKeyId: string,
  threshold: number,
  shareCount: number,
  ephRPoints: SerializableBigInt[],
  allEphSecretShares: SecretShare[][],
  allEphVssSchemes: VSSScheme[],
  partyIndex: number,
  signingParties: number[]
);
// Returns: { ephSharedKey: EphemeralSharedKey }
```

##### `computeLocalSignature(message, ephSharedKey)`

Computes local signature component.

```typescript
const result = service.computeLocalSignature(
  message: Buffer,
  ephSharedKey: EphemeralSharedKey
);
// Returns: { localSig: LocalSignature }
```

### CoordinatorService

Service that orchestrates the MPC protocol.

#### Constructor

```typescript
new CoordinatorService();
```

#### Methods

##### `startKeyGeneration(threshold, totalParties)`

Starts a key generation session.

```typescript
coordinator.startKeyGeneration(threshold: number, totalParties: number);
```

##### `registerParty(partyId, publicKey)`

Registers a party in the key generation session.

```typescript
coordinator.registerParty(partyId: string, publicKey: PublicKey);
```

##### `collectCommitments(partyCommitments)`

Collects commitments from all parties.

```typescript
const result = coordinator.collectCommitments([
  {
    partyId: string,
    commitment: SerializableBigInt,
    blindFactor: SerializableBigInt,
  },
  // ...
]);
// Returns: { threshold, shareCount, blindFactors, publicKeys, commitments, parties }
```

##### `collectShares(partyShares)`

Collects secret shares from all parties.

```typescript
const result = coordinator.collectShares([
  { partyId: string, vss: VSSScheme, secretShares: SecretShare[] },
  // ...
]);
// Returns: { [partyId]: { threshold, shareCount, publicKeys, allSecretShares, allVssSchemes, partyIndex } }
```

##### `collectSharedKeys(partySharedKeys)`

Collects shared keys and computes aggregate public key.

```typescript
const result = coordinator.collectSharedKeys([
  { partyId: string, sharedKey: SharedKey },
  // ...
]);
// Returns: { aggregatePublicKey: PublicKey }
```

##### `startSigning(message, signingParties)`

Starts a signing session.

```typescript
const session = coordinator.startSigning(
  message: Buffer,
  signingParties: string[]
);
// Returns: { signingParties: number[] }
```

##### `collectEphemeralKeysAndCommitments(partyEphData)`

Collects ephemeral keys and commitments.

```typescript
const result = coordinator.collectEphemeralKeysAndCommitments([
  {
    partyId: string,
    ephR: SerializableBigInt,
    ephKeyId: string,
    commitment: SerializableBigInt,
    blindFactor: SerializableBigInt,
  },
  // ...
]);
// Returns: { ephBlindFactors, ephRPoints, ephCommitments }
```

##### `collectEphemeralShares(partyEphShares)`

Collects ephemeral shares.

```typescript
const result = coordinator.collectEphemeralShares([
  { partyId: string, vss: VSSScheme, secretShares: SecretShare[] },
  // ...
]);
// Returns: { [partyId]: { allEphSecretShares, allEphVssSchemes, partyIndex } }
```

##### `collectLocalSignatures(partyLocalSigs)`

Collects local signatures and aggregates them.

```typescript
const result = coordinator.collectLocalSignatures([
  { partyId: string, localSig: LocalSignature },
  // ...
]);
// Returns: { signature: Signature, isValid: boolean }
```

## Examples

### Complete MPC Protocol Example

Demonstrates the full MPC protocol including key generation and signing:

```bash
npm run example:mpc -- 2 3 party-0,party-1
```

**Arguments:**

- `threshold` (default: 2) - Minimum parties needed to sign
- `totalParties` (default: 3) - Total number of parties
- `signingParties` (default: party-0,party-1) - Comma-separated party IDs

**What it shows:**

- Party registration and key generation
- Commitment and share distribution
- Shared keypair construction
- Ephemeral key generation for signing
- Local signature computation and aggregation
- Signature verification

### Solana Transaction POC

Demonstrates signing and sending Solana transactions using MPC threshold signatures:

```bash
npm run example:solana -- 2 3 party-0,party-1
```

**Prerequisites:**

```bash
# Start Solana test validator
solana-test-validator
```

**What it shows:**

- Complete MPC protocol execution
- Converting MPC signatures to Solana's 64-byte format
- Creating Solana transfer transactions
- Signing transactions with MPC signatures
- Sending transactions to the network

## Solana Integration

### Converting MPC Signatures to Solana Format

Solana uses Ed25519 signatures in a 64-byte format: `R (32 bytes) + s (32 bytes)`

```typescript
import { MPCService, CoordinatorService } from "multi-party-eddsa";
import { Transaction, PublicKey } from "@solana/web3.js";

// After getting MPC signature from coordinator.collectLocalSignatures()
const mpcSignature = result.signature;

// Extract R and s components
const rBytes = Buffer.from(mpcSignature.r.bytes);
const sBytes = Buffer.from(mpcSignature.s.bytes);

// Create 64-byte Solana signature
const solanaSignature = Buffer.concat([rBytes, sBytes]);

// Add to transaction
const senderPubkey = new PublicKey(aggregatePublicKeyBytes);
transaction.addSignature(senderPubkey, solanaSignature);
```

### Important Notes for Solana

1. **Transaction Type**: Only compatible with **legacy (non-versioned) transactions**
2. **Signature Format**: Must be exactly 64 bytes (32-byte R + 32-byte s)
3. **Public Key**: The aggregate public key must match the transaction's fee payer
4. **Message Signing**: The transaction message must be signed exactly as serialized

## Limitations

### General Limitations

1. **Threshold Requirements**:
   - Minimum threshold is 2 (t ≥ 2)
   - Threshold cannot exceed total parties (t ≤ n)
   - At least `threshold` parties must participate in signing

2. **Performance**:
   - Key generation requires multiple rounds of communication
   - Signing requires ephemeral key generation for each signature
   - Network latency affects protocol completion time

3. **State Management**:
   - Each party must maintain state across protocol phases
   - Coordinator must track all parties and their contributions
   - State must be synchronized correctly for protocol to succeed

### Solana-Specific Limitations

**Important**: EdDSA signing for Solana has specific compatibility constraints:

1. **Transaction Type Compatibility**:
   - **Supported**: Legacy (non-versioned) transactions (`Transaction` class)
   - **Not Supported**: Versioned transactions (`VersionedTransaction` class)
   - The library only works with transactions that use the legacy transaction format

2. **Signature Scheme**:
   - **Supported**: Ed25519 signatures (EdDSA)
   - **Not Supported**: Other signature schemes (ECDSA, etc.)
   - Solana's Ed25519 signature format is 64 bytes: R (32 bytes) + s (32 bytes)

3. **Transaction Instructions**:
   - **Supported**: Standard instructions (transfers, program calls, etc.)
   - **May have issues**: Complex transactions with multiple signers
   - The MPC signature must be the first (fee payer) signature

4. **Network Compatibility**:
   - **Tested**: Local test validator, Devnet
   - **Use with caution**: Mainnet (ensure proper testing first)
   - Transaction simulation may fail if signature format is incorrect

5. **Key Derivation**:
   - The aggregate public key from MPC must be used as the transaction's fee payer
   - Cannot use derived keys or program-derived addresses (PDAs) directly
   - The public key must be a valid Ed25519 public key (32 bytes)

### Workarounds and Best Practices

1. **For Versioned Transactions**:
   - Convert to legacy format before signing, or
   - Use a wrapper that converts versioned transactions to legacy format

2. **For Multiple Signers**:
   - Ensure MPC signature is the first signature (fee payer)
   - Other signers can be added after MPC signing

3. **For Production Use**:
   - Thoroughly test on Devnet first
   - Verify signature format matches Solana's expectations
   - Monitor transaction success rates
   - Implement proper error handling and retry logic

## TypeScript Support

The library is written in TypeScript and includes full type definitions:

```typescript
import { MPCService, CoordinatorService, PublicKey, Signature } from 'multi-party-eddsa';

// All types are available
const service: MPCService = new MPCService('party-0');
const publicKey: PublicKey = { bytes: Buffer.from([...]) };
```

## Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Building

```bash
# Build TypeScript to JavaScript
npm run build

# Watch mode for development
npm run watch

# Clean build artifacts
npm run clean
```

## Project Structure

```
nodejs/
├── src/
│   ├── client/          # Low-level MPC client
│   ├── services/        # MPCService and CoordinatorService
│   ├── utils/           # Utility functions (serialization, validation)
│   ├── types/           # TypeScript type definitions
│   ├── errors/          # Custom error classes
│   └── index.ts         # Main entry point
├── tests/               # Test files
├── examples/            # Example implementations
│   ├── complete_mpc_protocol.ts
│   └── solana_transaction_poc.ts
└── dist/                # Compiled JavaScript (generated)
```

## Contributing

Contributions are welcome! Please ensure:

- All tests pass
- TypeScript compiles without errors
- Code follows existing style conventions
- New features include appropriate tests

## License

MIT

## Support

For issues, questions, or contributions, please refer to the project repository.
