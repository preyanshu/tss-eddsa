# Multi-Party EdDSA Node.js Bindings

Node.js bindings for threshold EdDSA signatures using NAPI.

## Building

```bash
cd node-bindings
npm install
npm run build
```

## Usage

The bindings expose all main functions from the threshold signing protocol:

### Key Generation

- `phase1_create(party_index)` - Create keys for a party
- `phase1_create_from_private_key(party_index, secret)` - Create keys from a 32-byte private key
- `get_public_key(key_id)` - Get the public key for a keys instance
- `phase1_broadcast(key_id)` - Phase 1 broadcast (returns commitment and blind factor)
- `phase1_verify_com_phase2_distribute(...)` - Phase 1 verify and Phase 2 distribute shares
- `phase2_verify_vss_construct_keypair(...)` - Phase 2 verify VSS and construct shared keys

### Ephemeral Key Generation (for signing)

- `ephemeral_key_create(key_id, message, index)` - Create ephemeral key
- `get_ephemeral_R(eph_key_id)` - Get ephemeral R point
- `ephemeral_phase1_broadcast(eph_key_id)` - Ephemeral Phase 1 broadcast
- `ephemeral_phase1_verify_com_phase2_distribute(...)` - Ephemeral Phase 1 verify and Phase 2 distribute
- `ephemeral_phase2_verify_vss_construct_keypair(...)` - Ephemeral Phase 2 verify and construct keypair

### Signing

- `compute_local_sig(message, ephemeral_shared_keys, shared_keys)` - Compute local signature
- `verify_local_sigs(...)` - Verify local signatures
- `generate_signature(...)` - Generate final signature
- `verify_signature(signature, message, public_key)` - Verify signature

## Example

See `../nodejs/example.js` for a complete example of a 2-of-3 threshold signature.

## Types

All cryptographic types (Point, Scalar, BigInt) are serialized as objects with a `bytes` field containing the byte representation.
