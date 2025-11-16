# Multi-Party EdDSA Node.js Bindings

Node.js native bindings for the Multi-Party EdDSA threshold signature library, built with [NAPI-RS](https://napi.rs/). These bindings provide low-level access to the Rust core implementation, exposing all cryptographic operations to JavaScript/TypeScript.

## Overview

This package provides the bridge between the Rust core implementation (`eddsa-core`) and Node.js applications. It's primarily used internally by the `eddsa-client` package, but can also be used directly for advanced use cases.

## Prerequisites

- **Node.js** >= 18.0.0
- **Rust** >= 1.70.0
- **Cargo** (Rust package manager)

## Installation

This package is typically installed as a workspace dependency. For standalone installation:

```bash
npm install multi-party-eddsa-node
```

## Building

### Development Build (Debug)

```bash
bun run build:debug
```

Builds the native bindings in debug mode. Faster to compile but slower at runtime.

### Production Build (Release)

```bash
bun run build
```

Builds optimized native bindings for production use. Slower to compile but faster at runtime.

**What it does:**
- Compiles Rust code to native Node.js addon (`.node` file)
- Generates TypeScript type definitions (`index.d.ts`)
- Creates platform-specific binaries (Linux, macOS, Windows)

## Available Scripts

### Build Scripts

```bash
# Build release version (optimized)
bun run build

# Build debug version (faster compilation)
bun run build:debug
```

**Output:**
- `multi-party-eddsa-node.<platform>.node` - Native binary
- `index.d.ts` - TypeScript definitions
- `index.js` - JavaScript wrapper

## Usage

### Direct Usage

```typescript
import * as thresholdSigModule from 'multi-party-eddsa-node';

const thresholdSig = thresholdSigModule.threshold_sig;

// Create keys for a party
const keyId = thresholdSig.phase1_create(0);

// Get public key
const publicKey = thresholdSig.get_public_key(keyId);

// Phase 1 broadcast (commitment)
const broadcast = thresholdSig.phase1_broadcast(keyId);

// Phase 1 verify and Phase 2 distribute shares
const shares = thresholdSig.phase1_verify_com_phase2_distribute(
  keyId,
  threshold,
  shareCount,
  blindFactors,
  publicKeys,
  commitments
);

// Phase 2 verify VSS and construct keypair
const sharedKey = thresholdSig.phase2_verify_vss_construct_keypair(
  keyId,
  threshold,
  shareCount,
  publicKeys,
  allSecretShares,
  allVssSchemes
);
```

### API Reference

#### Key Generation

##### `phase1_create(party_index: number): string`

Creates keys for a party in the key generation protocol.

**Parameters:**
- `party_index` (number): Zero-based index of the party

**Returns:**
- `string`: Key ID for this party's keys

##### `phase1_create_from_private_key(party_index: number, secret: Uint8Array): string`

Creates keys from a 32-byte private key.

**Parameters:**
- `party_index` (number): Zero-based index of the party
- `secret` (Uint8Array): 32-byte private key

**Returns:**
- `string`: Key ID for this party's keys

##### `get_public_key(key_id: string): PublicKey`

Gets the public key for a keys instance.

**Parameters:**
- `key_id` (string): Key ID from `phase1_create`

**Returns:**
- `PublicKey`: Public key object with `bytes` field

##### `phase1_broadcast(key_id: string): BroadcastResult`

Phase 1 broadcast (returns commitment and blind factor).

**Parameters:**
- `key_id` (string): Key ID

**Returns:**
- `BroadcastResult`: Object with `commitment` and `blindFactor` fields

##### `phase1_verify_com_phase2_distribute(...): ShareResult`

Phase 1 verify commitments and Phase 2 distribute shares.

**Parameters:**
- `key_id` (string): Key ID
- `threshold` (number): Minimum parties needed to sign
- `share_count` (number): Total number of parties
- `blind_factors` (SerializableBigInt[]): Blind factors from all parties
- `public_keys` (PublicKey[]): Public keys from all parties
- `commitments` (Commitment[]): Commitments from all parties

**Returns:**
- `ShareResult`: Object with `vss` and `secretShares` fields

##### `phase2_verify_vss_construct_keypair(...): SharedKey`

Phase 2 verify VSS schemes and construct shared keypair.

**Parameters:**
- `key_id` (string): Key ID
- `threshold` (number): Minimum parties needed to sign
- `share_count` (number): Total number of parties
- `public_keys` (PublicKey[]): Public keys from all parties
- `all_secret_shares` (SecretShare[][]): Secret shares from all parties
- `all_vss_schemes` (VSSScheme[]): VSS schemes from all parties

**Returns:**
- `SharedKey`: Shared key object

#### Ephemeral Key Generation (for Signing)

##### `ephemeral_key_create(key_id: string, message: Uint8Array, index: number): string`

Creates ephemeral key for signing.

**Parameters:**
- `key_id` (string): Key ID from key generation
- `message` (Uint8Array): Message to sign
- `index` (number): Party index

**Returns:**
- `string`: Ephemeral key ID

##### `get_ephemeral_R(eph_key_id: string): SerializableBigInt`

Gets ephemeral R point.

**Parameters:**
- `eph_key_id` (string): Ephemeral key ID

**Returns:**
- `SerializableBigInt`: R point with `bytes` field

##### `ephemeral_phase1_broadcast(eph_key_id: string): BroadcastResult`

Ephemeral Phase 1 broadcast (commitment).

**Parameters:**
- `eph_key_id` (string): Ephemeral key ID

**Returns:**
- `BroadcastResult`: Object with `commitment` and `blindFactor` fields

##### `ephemeral_phase1_verify_com_phase2_distribute(...): ShareResult`

Ephemeral Phase 1 verify and Phase 2 distribute shares.

**Parameters:**
- `eph_key_id` (string): Ephemeral key ID
- `threshold` (number): Minimum parties needed to sign
- `share_count` (number): Total number of parties
- `eph_blind_factors` (SerializableBigInt[]): Ephemeral blind factors
- `eph_r_points` (SerializableBigInt[]): Ephemeral R points
- `eph_commitments` (Commitment[]): Ephemeral commitments
- `signing_parties` (number[]): Indices of signing parties

**Returns:**
- `ShareResult`: Object with `vss` and `secretShares` fields

##### `ephemeral_phase2_verify_vss_construct_keypair(...): EphemeralSharedKey`

Ephemeral Phase 2 verify and construct keypair.

**Parameters:**
- `eph_key_id` (string): Ephemeral key ID
- `threshold` (number): Minimum parties needed to sign
- `share_count` (number): Total number of parties
- `eph_r_points` (SerializableBigInt[]): Ephemeral R points
- `all_eph_secret_shares` (SecretShare[][]): All ephemeral secret shares
- `all_eph_vss_schemes` (VSSScheme[]): All ephemeral VSS schemes
- `party_index` (number): Party index
- `signing_parties` (number[]): Indices of signing parties

**Returns:**
- `EphemeralSharedKey`: Ephemeral shared key object

#### Signing

##### `compute_local_sig(message: Uint8Array, ephemeral_shared_keys: EphemeralSharedKey[], shared_keys: SharedKey[]): LocalSignature`

Computes local signature component.

**Parameters:**
- `message` (Uint8Array): Message to sign
- `ephemeral_shared_keys` (EphemeralSharedKey[]): Ephemeral shared keys
- `shared_keys` (SharedKey[]): Shared keys from key generation

**Returns:**
- `LocalSignature`: Local signature object

##### `verify_local_sigs(...): boolean`

Verifies local signatures.

**Parameters:**
- `local_sigs` (LocalSignature[]): Local signatures from all signing parties
- `message` (Uint8Array): Message that was signed
- `ephemeral_shared_keys` (EphemeralSharedKey[]): Ephemeral shared keys
- `shared_keys` (SharedKey[]): Shared keys

**Returns:**
- `boolean`: True if all local signatures are valid

##### `generate_signature(...): Signature`

Generates final signature from local signatures.

**Parameters:**
- `local_sigs` (LocalSignature[]): Local signatures from all signing parties
- `message` (Uint8Array): Message that was signed
- `ephemeral_shared_keys` (EphemeralSharedKey[]): Ephemeral shared keys
- `shared_keys` (SharedKey[]): Shared keys

**Returns:**
- `Signature`: Final signature object with `r` and `s` fields

##### `verify_signature(signature: Signature, message: Uint8Array, public_key: PublicKey): boolean`

Verifies a signature.

**Parameters:**
- `signature` (Signature): Signature to verify
- `message` (Uint8Array): Message that was signed
- `public_key` (PublicKey): Public key to verify against

**Returns:**
- `boolean`: True if signature is valid

## Type Definitions

All cryptographic types are serialized as objects with a `bytes` field containing the byte representation:

```typescript
interface SerializableBigInt {
  bytes: Uint8Array;
}

interface PublicKey {
  bytes: Uint8Array;
}

interface Signature {
  r: SerializableBigInt;
  s: SerializableBigInt;
}
```

## Project Structure

```
eddsa-bindings/
├── src/
│   └── lib.rs              # NAPI-RS bindings code
├── Cargo.toml              # Rust package configuration
├── build.rs                # Build script
├── index.js                # JavaScript wrapper (generated)
├── index.d.ts              # TypeScript definitions (generated)
├── package.json
└── README.md
```

## Dependencies

- **eddsa-core**: Rust core library (path dependency)
- **@napi-rs/cli**: Build tool for NAPI-RS

## Building from Source

1. Ensure Rust is installed:
   ```bash
   rustc --version
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Build:
   ```bash
   bun run build
   ```

## Troubleshooting

### Build Fails

**Problem**: `cargo` command not found
- **Solution**: Install Rust from [rustup.rs](https://rustup.rs/)

**Problem**: NAPI build fails
- **Solution**: Ensure `@napi-rs/cli` is installed: `bun add -D @napi-rs/cli`

**Problem**: Cannot find `eddsa-core` dependency
- **Solution**: Ensure `eddsa-core` is built first: `cd ../eddsa-core && cargo build`

### Runtime Issues

**Problem**: Cannot load `.node` file
- **Solution**: Ensure the correct platform binary is built
- **Solution**: Check that `index.js` points to the correct `.node` file

**Problem**: Module not found
- **Solution**: Ensure the package is built: `bun run build`
- **Solution**: Check that the package is properly linked in the workspace

## License

GPL-3.0
