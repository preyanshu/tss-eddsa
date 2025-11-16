# Multi-Party EdDSA Examples

Example implementations demonstrating how to use the Multi-Party EdDSA library for threshold signature operations.

## Overview

This package contains complete, runnable examples that demonstrate:
- Full MPC protocol flow (key generation and signing)
- Solana transaction signing with MPC signatures
- Best practices for using the library

## Prerequisites

- Node.js >= 18.0.0
- Bun >= 1.2.20 (or npm/yarn/pnpm)
- All dependencies installed: `bun install` (from root)

### For Solana Examples

- **Solana CLI** installed and in PATH
- **Solana test validator** running (for local testing)

## Available Examples

### 1. Complete MPC Protocol (`complete_mpc_protocol.ts`)

A comprehensive example showing the full MPC protocol flow from key generation to signature creation.

#### What It Demonstrates

- **Key Generation Phase**:
  - Party registration
  - Commitment generation
  - Secret share distribution
  - Shared keypair construction
  - Aggregate public key generation

- **Signing Phase**:
  - Ephemeral key generation
  - Ephemeral share distribution
  - Local signature computation
  - Signature aggregation
  - Signature verification

#### Running the Example

```bash
cd apps/eddsa-examples

# Run with default parameters (2-of-3 threshold, party-0 and party-1 signing)
bun run example:mpc

# Run with custom parameters
bun run example:mpc -- 2 3 party-0,party-1
```

#### Command-Line Arguments

- `threshold` (default: 2) - Minimum parties needed to sign
- `totalParties` (default: 3) - Total number of parties
- `signingParties` (default: "party-0,party-1") - Comma-separated party IDs that will sign

#### Example Output

```
╔══════════════════════════════════════════════════════════════╗
║     Complete MPC Protocol Demonstration                      ║
╚══════════════════════════════════════════════════════════════╝
Configuration: (t=2, n=3) threshold signature
Signing parties: 2 (party-0, party-1)

┌──────────────────────────────────────────────────────────────┐
│ PHASE 1: KEY GENERATION                                       │
└──────────────────────────────────────────────────────────────┘
Step 1: Coordinator starts key generation session
Step 2: MPC Services register with coordinator
Step 3: Coordinator requests commitments from all parties
Step 4: Coordinator requests secret shares from all parties
Step 5: Coordinator requests keypair construction from all parties
  Aggregate Public Key: c7255c60ccf7967591f666302a2aa258c09414db...

┌──────────────────────────────────────────────────────────────┐
│ PHASE 2: SIGNING                                             │
└──────────────────────────────────────────────────────────────┘
Message to sign: "Hello, Threshold Signatures!"
Step 1: Coordinator starts signing session
Step 2: Coordinator requests ephemeral keys and commitments
Step 3: Coordinator requests ephemeral shares from signing parties
Step 4: Coordinator requests ephemeral keypair construction
Step 5: Coordinator requests local signatures from signing parties

┌──────────────────────────────────────────────────────────────┐
│ RESULTS                                                      │
└──────────────────────────────────────────────────────────────┘
Signature Components:
  R: 5465c0545b8d71d93ce2ff245ef34055...
  s: 3f3a43f265955fbd6bf7b23289ba0ab0...
Verification: ✓ VALID
✓ Example completed successfully
```

### 2. Solana Transaction POC (`solana_transaction_poc.ts`)

A proof-of-concept demonstrating how to sign and send Solana transactions using MPC threshold signatures.

#### What It Demonstrates

- Complete MPC protocol execution
- Converting MPC signatures to Solana's 64-byte format
- Creating Solana transfer transactions
- Signing transactions with MPC signatures
- Sending transactions to the Solana network
- Transaction confirmation and verification

#### Prerequisites

1. **Start Solana Test Validator**:
   ```bash
   solana-test-validator
   ```
   This starts a local Solana validator on `http://localhost:8899`.

2. **Set Solana CLI Configuration** (if needed):
   ```bash
   solana config set --url localhost
   ```

#### Running the Example

```bash
cd apps/eddsa-examples

# Run with default parameters
bun run example:solana

# Run with custom parameters
bun run example:solana -- 2 3 party-0,party-1
```

#### Command-Line Arguments

Same as the complete MPC protocol example:
- `threshold` (default: 2)
- `totalParties` (default: 3)
- `signingParties` (default: "party-0,party-1")

#### Example Output

```
╔══════════════════════════════════════════════════════════════╗
║     Solana Transaction Signing POC                          ║
╚══════════════════════════════════════════════════════════════╝
┌──────────────────────────────────────────────────────────────┐
│ STEP 1: Connect to Solana Network                           │
└──────────────────────────────────────────────────────────────┘
Connecting to Solana localnet...
  URL: http://localhost:8899
✓ Connected successfully
  Solana version: 2.3.13

┌──────────────────────────────────────────────────────────────┐
│ STEP 2: Generate MPC Keys for Transaction                  │
└──────────────────────────────────────────────────────────────┘
Transaction Details:
  Sender (MPC): 8tVczvSPfLAbu2XkHES8jLJ1n1qA2utUeuxrqTtHMy6K
  Recipient: G2JPbUMsZLuc8LnsBbc2zqz7AeJDoLStysA5GrABokH4
  MPC Public Key: 7532ca8e8fc89bebf5f5775a1abe6ebf6ef873988a495d1580e81f74276bf594...

┌──────────────────────────────────────────────────────────────┐
│ STEP 3: Fund Sender Account                                   │
└──────────────────────────────────────────────────────────────┘
Requesting airdrop...
✓ Airdrop successful: 2 SOL

┌──────────────────────────────────────────────────────────────┐
│ STEP 4: Create Transfer Transaction                        │
└──────────────────────────────────────────────────────────────┘
Transaction created:
  Amount: 0.1 SOL
  Blockhash: HucRVnnRgr6xf9Sg...

┌──────────────────────────────────────────────────────────────┐
│ STEP 5: Sign Transaction with MPC                           │
└──────────────────────────────────────────────────────────────┘
Signing transaction message with MPC...
  Transaction message length: 150 bytes
✓ Transaction signed with MPC (2 parties)
  Signature valid: ✓ YES

┌──────────────────────────────────────────────────────────────┐
│ STEP 6: Convert to Solana Signature Format                  │
└──────────────────────────────────────────────────────────────┘
Signature conversion:
  MPC R: a478b97692db41587808f76147a6c991...
  MPC s: 23b595af04c24b75d9991d9487e672f9...
  Solana signature: a478b97692db41587808f76147a6c9915a2abc7a444c5af4276e753b45cd6fa7...
  Length: 64 bytes ✓

┌──────────────────────────────────────────────────────────────┐
│ STEP 7: Add Signature to Transaction                        │
└──────────────────────────────────────────────────────────────┘
✓ MPC signature added to transaction
  Transaction has 1 signature(s)

┌──────────────────────────────────────────────────────────────┐
│ STEP 8: Send Transaction to Solana Network                 │
└──────────────────────────────────────────────────────────────┘
Sending transaction...
✓ Transaction sent successfully!
  Transaction signature: 4HitTbCk3srPc5bKcHBRxDfVohaGaegZ3qzrEoyegFG4JU8gtkoRsxTZG9VS5Qp8Pr9URyQMwvTaFBzGQZ9LGCZq
Waiting for confirmation...
✓ Transaction confirmed successfully!
  View on Solana Explorer: https://explorer.solana.com/tx/...
Transaction Details:
  Status: SUCCESS
  Fee: 5000 lamports
  Balance change: -0.100005 SOL
✓ Solana POC completed successfully
```

## Available Scripts

### Example Scripts

```bash
# Run complete MPC protocol example
bun run example:mpc

# Run Solana transaction example
bun run example:solana
```

**What they do:**
- Execute the complete MPC protocol flow
- Demonstrate real-world usage patterns
- Show proper error handling
- Display detailed progress information

## Architecture

Both examples simulate a distributed architecture where:

- **Each party** runs an `MPCService` on their own server
- **A coordinator** runs a `CoordinatorService` to orchestrate the protocol
- **Services communicate** via HTTP APIs (simulated in these examples)

In production, these services would run on separate servers and communicate over HTTP.

## Understanding the Examples

### Key Concepts Demonstrated

1. **Service Initialization**: How to set up `MPCService` and `CoordinatorService`
2. **Key Generation Flow**: Complete DKG protocol execution
3. **Signing Flow**: Ephemeral key generation and signature aggregation
4. **Error Handling**: Proper validation and error checking
5. **State Management**: Maintaining state across protocol phases

### Code Structure

Each example follows this pattern:

1. **Setup**: Initialize services and configuration
2. **Key Generation**: Execute DKG protocol
3. **Signing**: Execute signing protocol
4. **Verification**: Verify the final signature
5. **Cleanup**: Display results and exit

## Troubleshooting

### Example Fails to Run

**Problem**: Cannot find module `multi-party-eddsa`
- **Solution**: Ensure dependencies are installed: `bun install` (from root)
- **Solution**: Ensure `eddsa-client` is built: `bun run build --filter=eddsa-client`

**Problem**: TypeScript compilation errors
- **Solution**: Run type check: `bun run check-types` (from root)
- **Solution**: Ensure all packages are built: `bun run build`

### Solana Example Issues

**Problem**: Cannot connect to Solana network
- **Solution**: Ensure `solana-test-validator` is running
- **Solution**: Check that validator is on `http://localhost:8899`

**Problem**: Transaction fails
- **Solution**: Check that sender account has sufficient balance
- **Solution**: Verify transaction format is correct (legacy, not versioned)
- **Solution**: Check Solana validator logs for errors

**Problem**: Airdrop fails
- **Solution**: Ensure validator is running and accessible
- **Solution**: Check network configuration

## Next Steps

After running the examples:

1. **Modify Parameters**: Try different threshold configurations
2. **Custom Messages**: Sign your own messages
3. **Integration**: Integrate into your own applications
4. **Production**: Review security considerations for production use

## Additional Resources

- [Main README](../../README.md) - Overview of the monorepo
- [Client Library README](../eddsa-client/README.md) - Full API documentation
- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)

## License

MIT
