# Multi-Party EdDSA Core (Rust)

Rust implementation of multi-party Ed25519 signature scheme, providing the core cryptographic operations for threshold EdDSA signatures.

## Overview

This is the core cryptographic library that implements:
- **Threshold EdDSA Signatures**: Require `t` out of `n` parties to sign
- **Distributed Key Generation (DKG)**: Secure key generation without a trusted dealer
- **Verifiable Secret Sharing (VSS)**: Share distribution with verification
- **Accountable-Subgroup Multisignatures**: Enhanced security properties
- **Aggregated Signatures**: Efficient signature aggregation

## Features

### Currently Supporting

- [Aggregated Signatures](https://github.com/KZen-networks/multi-party-ed25519/wiki/Aggregated-Ed25519-Signatures)
- [Accountable-Subgroup Multisignatures](https://github.com/KZen-networks/multi-party-schnorr/blob/master/papers/accountable_subgroups_multisignatures.pdf)
- Threshold EdDSA scheme based on [provably secure distributed schnorr signatures and a {t,n} threshold scheme](https://github.com/KZen-networks/multi-party-schnorr/blob/master/papers/provably_secure_distributed_schnorr_signatures_and_a_threshold_scheme.pdf)

For more efficient implementation, we used the DKG from [Fast Multiparty Threshold ECDSA with Fast Trustless Setup](https://eprint.iacr.org/2019/114.pdf). The cost is robustness: if there is a malicious party out of the n parties in DKG the protocol stops and if there is a malicious party out of the t parties used for signing the signature protocol will stop.

The above protocols are for Schnorr signature system. EdDSA is a variant of Schnorr signature system with (possibly twisted) Edwards curves. We adopt the multi party implementations to follow Ed25519 methods for private key and public key generation according to [RFC8032](https://tools.ietf.org/html/rfc8032#section-5.1).

## Prerequisites

- **Rust** >= 1.70.0
- **Cargo** (Rust package manager, installed with Rust)

## Building

### Development Build

```bash
cargo build
```

Builds the library in debug mode. Faster to compile but slower at runtime.

### Release Build

```bash
cargo build --release
```

Builds optimized library for production use. Slower to compile but faster at runtime.

### Running Tests

```bash
# Run all tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Run specific test
cargo test test_name
```

### Running Benchmarks

```bash
cargo bench
```

## Project Structure

```
eddsa-core/
├── src/
│   ├── lib.rs                    # Library entry point
│   └── protocols/
│       └── thresholdsig/
│           ├── mod.rs            # Threshold signature module
│           └── test.rs           # Tests
├── Cargo.toml                    # Rust package configuration
├── LICENSE                       # GPL-3.0 license
└── README.md
```

## API Overview

The library provides low-level cryptographic primitives for:

1. **Key Generation**:
   - Phase 1: Create keys and generate commitments
   - Phase 2: Distribute shares using VSS
   - Phase 3: Construct shared keypairs

2. **Ephemeral Key Generation** (for signing):
   - Generate one-time keys for each signature
   - Distribute ephemeral shares
   - Construct ephemeral keypairs

3. **Signing**:
   - Compute local signature components
   - Aggregate signatures
   - Verify signatures

## Usage

This library is primarily used through the NAPI bindings (`eddsa-bindings`) or directly in Rust projects.

### As a Rust Dependency

Add to your `Cargo.toml`:

```toml
[dependencies]
multi-party-eddsa = { path = "../eddsa-core" }
```

### Direct Usage (Rust)

```rust
use multi_party_eddsa::protocols::thresholdsig::*;

// Key generation phase 1
let key_id = phase1_create(0)?;
let public_key = get_public_key(&key_id)?;
let broadcast = phase1_broadcast(&key_id)?;

// ... continue with protocol phases
```

## Dependencies

Key dependencies:
- **curve25519-dalek**: Ed25519 curve operations
- **sha2**: SHA-256 hashing
- **rand**: Random number generation
- **serde**: Serialization support

## Testing

The library includes comprehensive tests:

```bash
# Run all tests
cargo test

# Run with verbose output
cargo test -- --nocapture

# Run specific test module
cargo test thresholdsig
```

## Performance

- **Key Generation**: O(n²) communication complexity
- **Signing**: O(t²) communication complexity (where t is threshold)
- **Verification**: O(1) for single signature verification

## Security Considerations

1. **Robustness**: The protocol stops if a malicious party is detected
2. **Threshold Security**: Requires at least `t` honest parties
3. **Randomness**: Uses cryptographically secure random number generation
4. **Side-Channel Resistance**: Constant-time operations where possible

## Limitations

1. **Malicious Party Handling**: Protocol stops on detection (not fault-tolerant)
2. **Threshold Requirements**: Minimum threshold of 2, maximum of n (total parties)
3. **Performance**: Multiple rounds of communication required

## License

GPL-3.0

See [LICENSE](LICENSE) for more information.

## Development Process

The contribution workflow is described in the main repository documentation.

## Contact

For questions or contributions:
- Open an issue on GitHub
- Refer to the main repository README

## References

- [RFC 8032: EdDSA](https://tools.ietf.org/html/rfc8032)
- [Multi-Party Schnorr Signatures](https://github.com/KZen-networks/multi-party-schnorr)
- [Fast Multiparty Threshold ECDSA](https://eprint.iacr.org/2019/114.pdf)
