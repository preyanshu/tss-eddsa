# Multi-Party EdDSA Client Library

A high-level TypeScript client library for implementing threshold EdDSA (Ed25519) signatures using Multi-Party Computation (MPC). This library enables distributed key generation and threshold signing where multiple parties must collaborate to create a signature, without any single party ever having access to the complete private key.

This package lives inside the [`tss-eddsa` Turborepo](https://github.com/preyanshu/tss-eddsa) and is the client foundation for Zengox’s MPC-backed EdDSA signing flows. For more end-to-end flows, explore the [examples workspace](https://github.com/preyanshu/tss-eddsa/tree/main/apps/eddsa-examples).

## Installation

```bash
npm install multi-party-eddsa
```

Or using Bun:

```bash
bun add multi-party-eddsa
```

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.0.0 (for TypeScript projects)
- Native bindings (`multi-party-eddsa-node`) - automatically included

## Quick Start

```typescript
import { MPCService, CoordinatorService } from 'multi-party-eddsa';

// Step 1: Initialize services for each party
const party0 = new MPCService('party-0');
const party1 = new MPCService('party-1');
const party2 = new MPCService('party-2');

// Step 2: Create coordinator to orchestrate the protocol
const coordinator = new CoordinatorService();

// Step 3: Start key generation (threshold=2, totalParties=3)
coordinator.startKeyGeneration(2, 3);

// Step 4: Register parties
const init0 = party0.register();
const init1 = party1.register();
const init2 = party2.register();

coordinator.registerParty('party-0', init0.publicKey);
coordinator.registerParty('party-1', init1.publicKey);
coordinator.registerParty('party-2', init2.publicKey);

// Step 5: Generate commitments
const commit0 = party0.generateCommitment();
const commit1 = party1.generateCommitment();
const commit2 = party2.generateCommitment();

const commitData = coordinator.collectCommitments([
  { partyId: 'party-0', ...commit0 },
  { partyId: 'party-1', ...commit1 },
  { partyId: 'party-2', ...commit2 },
]);

// Step 6: Distribute shares and construct keypairs
// ... (see full example below)

// Step 7: Sign a message
const message = Buffer.from('Hello, Threshold Signatures!');
const signingSession = coordinator.startSigning(message, ['party-0', 'party-1']);

// ... (complete signing flow)

// Step 8: Get final signature
const result = coordinator.collectLocalSignatures([...]);
console.log('Signature:', result.signature);
console.log('Valid:', result.isValid);
```

## Features

- **Threshold Signatures**: Require `t` out of `n` parties to sign
- **Distributed Key Generation**: No single party knows the full private key
- **Multi-Party Computation**: Secure cryptographic operations across parties
- **Ed25519 Support**: Compatible with Ed25519 signature scheme
- **Solana Integration**: Sign and send Solana transactions with MPC signatures
- **TypeScript**: Full TypeScript support with comprehensive type definitions
- **Error Handling**: Custom error classes for different failure scenarios

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

Service that runs on each party's server to handle local MPC operations.

#### Constructor

```typescript
new MPCService(partyId: string)
```

**Parameters:**

- `partyId` (string): Unique identifier for this party (e.g., "party-0")

**Example:**

```typescript
const service = new MPCService("party-0");
```

#### Methods

##### `register()`

Registers the party and generates initial public key for key generation.

**Returns:**

```typescript
{
  publicKey: SerializableBigInt;
}
```

**Example:**

```typescript
const result = service.register();
console.log("Public Key:", result.publicKey);
```

##### `generateCommitment()`

Generates a commitment for the key generation phase. Commitments ensure parties cannot cheat during share distribution.

**Returns:**

```typescript
{
  commitment: SerializableBigInt,
  blindFactor: SerializableBigInt
}
```

**Example:**

```typescript
const result = service.generateCommitment();
// Send commitment and blindFactor to coordinator
```

##### `distributeShares(threshold, shareCount, blindFactors, publicKeys, commitments, partyIndex)`

Distributes secret shares to all parties using Verifiable Secret Sharing (VSS).

**Parameters:**

- `threshold` (number): Minimum parties needed to sign
- `shareCount` (number): Total number of parties
- `blindFactors` (SerializableBigInt[]): Blind factors from all parties
- `publicKeys` (PublicKey[]): Public keys from all parties
- `commitments` (Commitment[]): Commitments from all parties
- `partyIndex` (number): This party's index (0-based)

**Returns:**

```typescript
{
  vss: VSSScheme,
  secretShares: SecretShare[]
}
```

**Example:**

```typescript
const result = service.distributeShares(
  2, // threshold
  3, // total parties
  blindFactors,
  publicKeys,
  commitments,
  0 // this party's index
);
```

##### `constructKeypair(threshold, shareCount, publicKeys, allSecretShares, allVssSchemes, partyIndex)`

Constructs the shared keypair from collected shares.

**Parameters:**

- `threshold` (number): Minimum parties needed to sign
- `shareCount` (number): Total number of parties
- `publicKeys` (PublicKey[]): Public keys from all parties
- `allSecretShares` (SecretShare[][]): Secret shares from all parties
- `allVssSchemes` (VSSScheme[]): VSS schemes from all parties
- `partyIndex` (number): This party's index

**Returns:**

```typescript
{
  sharedKey: SharedKey;
}
```

**Example:**

```typescript
const result = service.constructKeypair(
  2, // threshold
  3, // total parties
  publicKeys,
  allSecretShares,
  allVssSchemes,
  0 // this party's index
);
```

##### `startEphemeralKeyGeneration(message, partyIndex)`

Starts ephemeral key generation for signing. Ephemeral keys are one-time keys used only for a single signature.

**Parameters:**

- `message` (Buffer): Message to sign
- `partyIndex` (number): This party's index

**Returns:**

```typescript
{
  ephR: SerializableBigInt,
  ephKeyId: string,
  commitment: SerializableBigInt,
  blindFactor: SerializableBigInt
}
```

**Example:**

```typescript
const message = Buffer.from("Hello, World!");
const result = service.startEphemeralKeyGeneration(message, 0);
```

##### `distributeEphemeralShares(ephKeyId, threshold, shareCount, ephBlindFactors, ephRPoints, ephCommitments, signingParties)`

Distributes ephemeral shares for signing.

**Parameters:**

- `ephKeyId` (string): Ephemeral key ID from `startEphemeralKeyGeneration`
- `threshold` (number): Minimum parties needed to sign
- `shareCount` (number): Total number of parties
- `ephBlindFactors` (SerializableBigInt[]): Ephemeral blind factors
- `ephRPoints` (SerializableBigInt[]): Ephemeral R points
- `ephCommitments` (Commitment[]): Ephemeral commitments
- `signingParties` (number[]): Indices of parties participating in signing

**Returns:**

```typescript
{
  vss: VSSScheme,
  secretShares: SecretShare[]
}
```

##### `constructEphemeralKeypair(ephKeyId, threshold, shareCount, ephRPoints, allEphSecretShares, allEphVssSchemes, partyIndex, signingParties)`

Constructs ephemeral keypair for signing.

**Parameters:**

- `ephKeyId` (string): Ephemeral key ID
- `threshold` (number): Minimum parties needed to sign
- `shareCount` (number): Total number of parties
- `ephRPoints` (SerializableBigInt[]): Ephemeral R points
- `allEphSecretShares` (SecretShare[][]): All ephemeral secret shares
- `allEphVssSchemes` (VSSScheme[]): All ephemeral VSS schemes
- `partyIndex` (number): This party's index
- `signingParties` (number[]): Indices of signing parties

**Returns:**

```typescript
{
  ephSharedKey: EphemeralSharedKey;
}
```

##### `computeLocalSignature(message, ephSharedKey)`

Computes local signature component. These are aggregated by the coordinator to form the final signature.

**Parameters:**

- `message` (Buffer): Message to sign
- `ephSharedKey` (EphemeralSharedKey): Ephemeral shared key from `constructEphemeralKeypair`

**Returns:**

```typescript
{
  localSig: LocalSignature;
}
```

**Example:**

```typescript
const result = service.computeLocalSignature(message, ephSharedKey);
// Send localSig to coordinator for aggregation
```

### CoordinatorService

Service that orchestrates the MPC protocol across all parties.

#### Constructor

```typescript
new CoordinatorService();
```

**Example:**

```typescript
const coordinator = new CoordinatorService();
```

#### Methods

##### `startKeyGeneration(threshold, totalParties)`

Starts a key generation session.

**Parameters:**

- `threshold` (number): Minimum parties needed to sign (must be >= 2)
- `totalParties` (number): Total number of parties (must be >= threshold)

**Example:**

```typescript
coordinator.startKeyGeneration(2, 3); // 2-of-3 threshold
```

##### `registerParty(partyId, publicKey)`

Registers a party in the key generation session.

**Parameters:**

- `partyId` (string): Unique identifier for the party
- `publicKey` (PublicKey): Public key from party's `register()` call

**Returns:**

```typescript
{
  partyId: string,
  partyIndex: number
}
```

**Example:**

```typescript
const result = coordinator.registerParty("party-0", publicKey);
console.log("Party index:", result.partyIndex);
```

##### `collectCommitments(partyCommitments)`

Collects commitments from all parties.

**Parameters:**

- `partyCommitments` (Array): Array of commitment objects from each party

**Returns:**

```typescript
{
  threshold: number,
  shareCount: number,
  blindFactors: SerializableBigInt[],
  publicKeys: PublicKey[],
  commitments: Commitment[],
  parties: Party[]
}
```

**Example:**

```typescript
const result = coordinator.collectCommitments([
  {
    partyId: "party-0",
    commitment: commit0.commitment,
    blindFactor: commit0.blindFactor,
  },
  {
    partyId: "party-1",
    commitment: commit1.commitment,
    blindFactor: commit1.blindFactor,
  },
  {
    partyId: "party-2",
    commitment: commit2.commitment,
    blindFactor: commit2.blindFactor,
  },
]);
```

##### `collectShares(partyShares)`

Collects secret shares from all parties.

**Parameters:**

- `partyShares` (Array): Array of share objects from each party

**Returns:**

```typescript
{
  [partyId: string]: {
    threshold: number,
    shareCount: number,
    publicKeys: PublicKey[],
    allSecretShares: SecretShare[][],
    allVssSchemes: VSSScheme[],
    partyIndex: number
  }
}
```

**Example:**

```typescript
const result = coordinator.collectShares([
  { partyId: "party-0", vss: vss0, secretShares: shares0 },
  { partyId: "party-1", vss: vss1, secretShares: shares1 },
  { partyId: "party-2", vss: vss2, secretShares: shares2 },
]);
```

##### `collectSharedKeys(partySharedKeys)`

Collects shared keys and computes aggregate public key.

**Parameters:**

- `partySharedKeys` (Array): Array of shared key objects from each party

**Returns:**

```typescript
{
  aggregatePublicKey: PublicKey;
}
```

**Example:**

```typescript
const result = coordinator.collectSharedKeys([
  { partyId: "party-0", sharedKey: key0.sharedKey },
  { partyId: "party-1", sharedKey: key1.sharedKey },
  { partyId: "party-2", sharedKey: key2.sharedKey },
]);
console.log("Aggregate Public Key:", result.aggregatePublicKey);
```

##### `startSigning(message, signingParties)`

Starts a signing session.

**Parameters:**

- `message` (Buffer): Message to sign
- `signingParties` (string[]): Array of party IDs that will participate in signing

**Returns:**

```typescript
{
  signingParties: number[]
}
```

**Example:**

```typescript
const message = Buffer.from("Hello, World!");
const session = coordinator.startSigning(message, ["party-0", "party-1"]);
```

##### `collectEphemeralKeysAndCommitments(partyEphData)`

Collects ephemeral keys and commitments from signing parties.

**Parameters:**

- `partyEphData` (Array): Array of ephemeral key data from each signing party

**Returns:**

```typescript
{
  ephBlindFactors: SerializableBigInt[],
  ephRPoints: SerializableBigInt[],
  ephCommitments: Commitment[]
}
```

##### `collectEphemeralShares(partyEphShares)`

Collects ephemeral shares from signing parties.

**Parameters:**

- `partyEphShares` (Array): Array of ephemeral share data from each signing party

**Returns:**

```typescript
{
  [partyId: string]: {
    allEphSecretShares: SecretShare[][],
    allEphVssSchemes: VSSScheme[],
    partyIndex: number
  }
}
```

##### `collectLocalSignatures(partyLocalSigs)`

Collects local signatures and aggregates them into the final signature.

**Parameters:**

- `partyLocalSigs` (Array): Array of local signature objects from each signing party

**Returns:**

```typescript
{
  signature: Signature,
  isValid: boolean
}
```

**Example:**

```typescript
const result = coordinator.collectLocalSignatures([
  { partyId: "party-0", localSig: localSig0 },
  { partyId: "party-1", localSig: localSig1 },
]);

if (result.isValid) {
  console.log("Signature is valid!");
  console.log("R:", result.signature.r);
  console.log("s:", result.signature.s);
}
```

## Available Scripts

### Build Scripts

```bash
# Build TypeScript to JavaScript
bun run build

# Watch mode for development
bun run watch

# Clean build artifacts
bun run clean
```

### Testing Scripts

```bash
# Run all tests
bun run test

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage
```

### Code Quality Scripts

```bash
# Lint code
bun run lint

# Type check without emitting files
bun run check-types
```

## TypeScript Support

The library is written in TypeScript and includes comprehensive type definitions:

```typescript
import {
  MPCService,
  CoordinatorService,
  MPCClient,
  PublicKey,
  Signature,
  SharedKey,
  EphemeralSharedKey,
  LocalSignature,
  SerializableBigInt,
  // ... and more
} from "multi-party-eddsa";
```

## Error Handling

The library includes custom error classes for different failure scenarios:

```typescript
import {
  ValidationError,
  PartyError,
  StateError,
  ProtocolError,
} from "multi-party-eddsa";

try {
  // ... MPC operations
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors
  } else if (error instanceof PartyError) {
    // Handle party-related errors
  } else if (error instanceof StateError) {
    // Handle state errors
  } else if (error instanceof ProtocolError) {
    // Handle protocol errors
  }
}
```

## Solana Integration

See the [Solana Transaction POC example](../../eddsa-examples/examples/solana_transaction_poc.ts) for a complete example of signing Solana transactions with MPC signatures.

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

2. **Signature Scheme**:
   - **Supported**: Ed25519 signatures (EdDSA)
   - **Not Supported**: Other signature schemes (ECDSA, etc.)

3. **Transaction Instructions**:
   - The MPC signature must be the first (fee payer) signature
   - Other signers can be added after MPC signing

## Project Structure

```
eddsa-client/
├── src/
│   ├── client/          # Low-level MPC client
│   │   └── mpc_client.ts
│   ├── services/        # MPCService and CoordinatorService
│   │   ├── mpc_service.ts
│   │   └── coordinator_service.ts
│   ├── utils/           # Utility functions
│   │   ├── serialization.ts
│   │   └── validation.ts
│   ├── types/           # TypeScript type definitions
│   │   └── index.ts
│   ├── errors/          # Custom error classes
│   │   └── index.ts
│   └── index.ts         # Main entry point
├── tests/               # Test files
│   ├── mpc_service.test.ts
│   ├── coordinator_service.test.ts
│   └── mpc_integration.test.ts
├── dist/                # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## Contributing

Contributions are welcome! Please ensure:

- All tests pass: `bun run test`
- TypeScript compiles without errors: `bun run check-types`
- Code is linted: `bun run lint`
- New features include appropriate tests
- Code follows existing style conventions

## License

MIT
