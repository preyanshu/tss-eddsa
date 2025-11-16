/**
 * Solana Transaction Signing POC (Proof of Concept)
 *
 * This example demonstrates how to use MPC threshold signatures to sign
 * and send Solana transactions. It shows:
 *
 * 1. Complete MPC protocol execution (key generation + signing)
 * 2. Converting MPC signatures to Solana format
 * 3. Creating and signing a Solana transaction
 * 4. Sending the transaction to Solana network
 *
 * Prerequisites:
 * - Solana test validator running: solana-test-validator
 * - Or connect to devnet/mainnet (modify connection URL)
 *
 * Usage:
 *   npm run example:solana -- 2 3 party-0,party-1
 *
 * Arguments:
 *   threshold (default: 2) - Minimum parties needed to sign
 *   totalParties (default: 3) - Total number of parties
 *   signingParties (default: party-0,party-1) - Comma-separated party IDs to sign
 */

import { MPCService, CoordinatorService } from "multi-party-eddsa";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

/**
 * Sign and send a Solana transaction using MPC threshold signatures
 */
export async function signAndSendSolanaTransaction(
  threshold: number = 2,
  totalParties: number = 3,
  signingParties: string[] = ["party-0", "party-1"],
): Promise<void> {
  console.log(
    "╔══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║     Solana Transaction Signing POC                          ║",
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════╝\n",
  );

  // ============================================
  // STEP 1: Connect to Solana Network
  // ============================================
  console.log(
    "┌──────────────────────────────────────────────────────────────┐",
  );
  console.log(
    "│ STEP 1: Connect to Solana Network                           │",
  );
  console.log(
    "└──────────────────────────────────────────────────────────────┘\n",
  );

  const connection = new Connection("http://localhost:8899", "confirmed");
  console.log("Connecting to Solana localnet...");
  console.log("  URL: http://localhost:8899\n");

  try {
    const version = await connection.getVersion();
    console.log(`✓ Connected successfully`);
    console.log(`  Solana version: ${version["solana-core"]}\n`);
  } catch (error: any) {
    console.log("⚠ Could not connect to Solana localnet");
    console.log("  Please start the test validator:");
    console.log("    solana-test-validator\n");
    console.log("  Or modify the connection URL to use devnet/mainnet\n");
    throw new Error("Solana connection failed");
  }

  // ============================================
  // STEP 2: Generate MPC Keys for Transaction
  // ============================================
  console.log(
    "┌──────────────────────────────────────────────────────────────┐",
  );
  console.log("│ STEP 2: Generate MPC Keys for Transaction                  │");
  console.log(
    "└──────────────────────────────────────────────────────────────┘\n",
  );

  // We need to generate keys first to get the public key that will sign the transaction
  // This ensures the signature will verify correctly
  const allPartyIds = Array.from(
    { length: totalParties },
    (_, i) => `party-${i}`,
  );
  const services: { [key: string]: MPCService } = {};
  for (const partyId of allPartyIds) {
    services[partyId] = new MPCService(partyId);
  }
  const coordinator = new CoordinatorService();

  // Generate keys for signing
  coordinator.startKeyGeneration(threshold, totalParties);
  for (const partyId of allPartyIds) {
    const init = services[partyId].register();
    coordinator.registerParty(partyId, init.publicKey);
  }

  const partyCommitments: Array<{
    partyId: string;
    commitment: any;
    blindFactor: any;
  }> = [];
  for (const partyId of allPartyIds) {
    const commit = services[partyId].generateCommitment();
    partyCommitments.push({ partyId, ...commit });
  }
  const commitData = coordinator.collectCommitments(partyCommitments);

  const partyShares: Array<{ partyId: string; vss: any; secretShares: any[] }> =
    [];
  for (let i = 0; i < allPartyIds.length; i++) {
    const partyId = allPartyIds[i];
    const shares = services[partyId].distributeShares(
      commitData.threshold,
      commitData.shareCount,
      commitData.blindFactors,
      commitData.publicKeys,
      commitData.commitments,
      commitData.parties[i],
    );
    partyShares.push({ partyId, ...shares });
  }
  const shareData = coordinator.collectShares(partyShares);

  const partySharedKeys: Array<{ partyId: string; sharedKey: any }> = [];
  for (const partyId of allPartyIds) {
    const keyResult = services[partyId].constructKeypair(
      shareData[partyId].threshold,
      shareData[partyId].shareCount,
      shareData[partyId].publicKeys,
      shareData[partyId].allSecretShares,
      shareData[partyId].allVssSchemes,
      shareData[partyId].partyIndex,
    );
    partySharedKeys.push({ partyId, sharedKey: keyResult.sharedKey });
  }
  const keygenResult = coordinator.collectSharedKeys(partySharedKeys);

  // Get the aggregate public key that will be used for signing
  const signingAggregatePubKeyBytes = Buffer.from(
    keygenResult.aggregatePublicKey.bytes,
  );
  if (signingAggregatePubKeyBytes.length !== 32) {
    throw new Error(
      `Invalid signing public key length: expected 32 bytes, got ${signingAggregatePubKeyBytes.length}`,
    );
  }
  const senderPubkey = new PublicKey(signingAggregatePubKeyBytes);

  // Create recipient address
  const recipientKeypair = Keypair.generate();
  const recipientPubkey = recipientKeypair.publicKey;

  console.log("Transaction Details:");
  console.log(`  Sender (MPC): ${senderPubkey.toBase58()}`);
  console.log(`  Recipient: ${recipientPubkey.toBase58()}`);
  console.log(
    `  MPC Public Key: ${signingAggregatePubKeyBytes.toString("hex").substring(0, 64)}...\n`,
  );

  // ============================================
  // STEP 3: Fund Sender Account
  // ============================================
  console.log(
    "┌──────────────────────────────────────────────────────────────┐",
  );
  console.log(
    "│ STEP 3: Fund Sender Account                                   │",
  );
  console.log(
    "└──────────────────────────────────────────────────────────────┘\n",
  );

  try {
    console.log("Requesting airdrop...");
    const airdropSignature = await connection.requestAirdrop(
      senderPubkey,
      2 * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(airdropSignature, "confirmed");
    console.log(`✓ Airdrop successful: 2 SOL\n`);
  } catch (error: any) {
    console.log(`⚠ Airdrop failed: ${error.message}`);
    console.log("  You may need to fund the account manually\n");
  }

  // ============================================
  // STEP 4: Create Transaction
  // ============================================
  console.log(
    "┌──────────────────────────────────────────────────────────────┐",
  );
  console.log("│ STEP 4: Create Transfer Transaction                        │");
  console.log(
    "└──────────────────────────────────────────────────────────────┘\n",
  );

  const amount = 0.1 * LAMPORTS_PER_SOL;
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: senderPubkey,
      toPubkey: recipientPubkey,
      lamports: amount,
    }),
  );

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = senderPubkey;

  console.log("Transaction created:");
  console.log(`  Amount: ${amount / LAMPORTS_PER_SOL} SOL`);
  console.log(`  Blockhash: ${blockhash.substring(0, 16)}...\n`);

  // ============================================
  // STEP 5: Sign Transaction with MPC
  // ============================================
  console.log(
    "┌──────────────────────────────────────────────────────────────┐",
  );
  console.log(
    "│ STEP 5: Sign Transaction with MPC                           │",
  );
  console.log(
    "└──────────────────────────────────────────────────────────────┘\n",
  );

  // Get transaction message for signing (keys already generated in STEP 2)
  const transactionMessage = transaction.serializeMessage();
  console.log("Signing transaction message with MPC...");
  console.log(
    `  Transaction message length: ${transactionMessage.length} bytes\n`,
  );

  // Sign transaction message using the keys we already generated
  const signingSession = coordinator.startSigning(
    transactionMessage,
    signingParties,
  );

  const partyEphData: Array<{
    partyId: string;
    ephR: any;
    ephKeyId: string;
    commitment: any;
    blindFactor: any;
  }> = [];
  for (let i = 0; i < signingParties.length; i++) {
    const partyId = signingParties[i];
    const eph = services[partyId].startEphemeralKeyGeneration(
      transactionMessage,
      signingSession.signingParties[i],
    );
    partyEphData.push({ partyId, ...eph });
  }
  const ephCommitData =
    coordinator.collectEphemeralKeysAndCommitments(partyEphData);

  const signingShareCount = signingParties.length;
  const signingThreshold = threshold;
  const partyEphShares: Array<{
    partyId: string;
    vss: any;
    secretShares: any[];
  }> = [];
  for (let i = 0; i < signingParties.length; i++) {
    const partyId = signingParties[i];
    const eph = partyEphData[i];
    const shares = services[partyId].distributeEphemeralShares(
      eph.ephKeyId,
      signingThreshold,
      signingShareCount,
      ephCommitData.ephBlindFactors,
      ephCommitData.ephRPoints,
      ephCommitData.ephCommitments,
      signingSession.signingParties,
    );
    partyEphShares.push({ partyId, ...shares });
  }
  const ephShareData = coordinator.collectEphemeralShares(partyEphShares);

  const ephSharedKeys: any[] = [];
  for (let i = 0; i < signingParties.length; i++) {
    const partyId = signingParties[i];
    const eph = partyEphData[i];
    const ephResult = services[partyId].constructEphemeralKeypair(
      eph.ephKeyId,
      signingThreshold,
      signingShareCount,
      ephCommitData.ephRPoints,
      ephShareData[partyId].allEphSecretShares,
      ephShareData[partyId].allEphVssSchemes,
      ephShareData[partyId].partyIndex,
      signingSession.signingParties,
    );
    ephSharedKeys.push(ephResult.ephSharedKey);
  }

  // Set coordinator state for signature aggregation
  (coordinator as any).ephSharedKeys = ephSharedKeys;
  (coordinator as any).allEphVssSchemes =
    ephShareData[signingParties[0]].allEphVssSchemes;
  (coordinator as any).allVssSchemes = shareData[allPartyIds[0]].allVssSchemes;
  (coordinator as any).signingPartyIndices = signingSession.signingParties;

  const partyLocalSigs: Array<{ partyId: string; localSig: any }> = [];
  for (let i = 0; i < signingParties.length; i++) {
    const partyId = signingParties[i];
    const localSigResult = services[partyId].computeLocalSignature(
      transactionMessage,
      ephSharedKeys[i],
    );
    partyLocalSigs.push({ partyId, localSig: localSigResult.localSig });
  }

  const txResult = coordinator.collectLocalSignatures(partyLocalSigs);
  console.log(
    `✓ Transaction signed with MPC (${signingParties.length} parties)`,
  );
  console.log(`  Signature valid: ${txResult.isValid ? "✓ YES" : "✗ NO"}\n`);

  // ============================================
  // STEP 6: Convert MPC Signature to Solana Format
  // ============================================
  console.log(
    "┌──────────────────────────────────────────────────────────────┐",
  );
  console.log(
    "│ STEP 6: Convert to Solana Signature Format                  │",
  );
  console.log(
    "└──────────────────────────────────────────────────────────────┘\n",
  );

  const txSigR = txResult.signature.r || (txResult.signature as any).R;
  const txSigS = txResult.signature.s || (txResult.signature as any).S;
  const rBytes = Buffer.from(txSigR.bytes);
  const sBytes = Buffer.from(txSigS.bytes);

  if (rBytes.length !== 32 || sBytes.length !== 32) {
    throw new Error(
      `Invalid signature component lengths: R=${rBytes.length}, s=${sBytes.length}`,
    );
  }

  // Solana uses 64-byte signatures: R (32 bytes) + s (32 bytes)
  const solanaSignature = Buffer.concat([rBytes, sBytes]);
  console.log("Signature conversion:");
  console.log(`  MPC R: ${rBytes.toString("hex").substring(0, 32)}...`);
  console.log(`  MPC s: ${sBytes.toString("hex").substring(0, 32)}...`);
  console.log(
    `  Solana signature: ${solanaSignature.toString("hex").substring(0, 64)}...`,
  );
  console.log(`  Length: ${solanaSignature.length} bytes ✓\n`);

  // ============================================
  // STEP 7: Add Signature to Transaction
  // ============================================
  console.log(
    "┌──────────────────────────────────────────────────────────────┐",
  );
  console.log(
    "│ STEP 7: Add Signature to Transaction                        │",
  );
  console.log(
    "└──────────────────────────────────────────────────────────────┘\n",
  );

  // Create 64-byte signature array (R + s)
  const signatureArray = new Uint8Array(64);
  signatureArray.set(rBytes, 0);
  signatureArray.set(sBytes, 32);

  // Add signature to transaction
  // Use the senderPubkey (which matches the keys used for signing)
  transaction.addSignature(senderPubkey, Buffer.from(signatureArray));
  console.log("✓ MPC signature added to transaction");
  console.log(
    `  Transaction has ${transaction.signatures.length} signature(s)`,
  );
  console.log(
    `  Signature (first 32 bytes): ${Buffer.from(signatureArray.slice(0, 32)).toString("hex").substring(0, 32)}...\n`,
  );

  // ============================================
  // STEP 8: Send Transaction to Solana Network
  // ============================================
  console.log(
    "┌──────────────────────────────────────────────────────────────┐",
  );
  console.log("│ STEP 8: Send Transaction to Solana Network                 │");
  console.log(
    "└──────────────────────────────────────────────────────────────┘\n",
  );

  try {
    const serializedTx = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    console.log("Sending transaction...");
    const txSignature = await connection.sendRawTransaction(serializedTx, {
      skipPreflight: false,
      maxRetries: 3,
    });

    console.log(`✓ Transaction sent successfully!`);
    console.log(`  Transaction signature: ${txSignature}\n`);

    // Wait for confirmation
    console.log("Waiting for confirmation...");
    const confirmation = await connection.confirmTransaction(
      txSignature,
      "confirmed",
    );

    if (confirmation.value.err === null) {
      console.log("✓ Transaction confirmed successfully!");
      console.log(
        `  View on Solana Explorer: https://explorer.solana.com/tx/${txSignature}?cluster=custom&customUrl=http://localhost:8899\n`,
      );

      // Get transaction details
      const txStatus = await connection.getTransaction(txSignature, {
        commitment: "confirmed",
      });
      if (txStatus && txStatus.meta && txStatus.meta.err === null) {
        console.log("Transaction Details:");
        console.log(`  Status: SUCCESS`);
        console.log(`  Fee: ${txStatus.meta.fee} lamports`);
        if (txStatus.meta.postBalances && txStatus.meta.preBalances) {
          const balanceChange =
            txStatus.meta.postBalances[0] - txStatus.meta.preBalances[0];
          console.log(
            `  Balance change: ${balanceChange / LAMPORTS_PER_SOL} SOL`,
          );
        }
      }
    } else {
      console.log(
        `✗ Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
      );
    }
  } catch (error: any) {
    console.log(`✗ Transaction failed: ${error.message}`);
    if (error.message.includes("signature")) {
      console.log(
        "  Note: Verify the MPC signature matches the transaction message",
      );
    }
    throw error;
  }
}

// Run the example if executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const threshold = args[0] ? parseInt(args[0], 10) : 2;
  const totalParties = args[1] ? parseInt(args[1], 10) : 3;
  const defaultSigningParties = Array.from(
    { length: threshold },
    (_, i) => `party-${i}`,
  );
  const signingPartiesArg = args[2]
    ? args[2].split(",")
    : defaultSigningParties;

  signAndSendSolanaTransaction(threshold, totalParties, signingPartiesArg)
    .then(() => {
      console.log("\n✓ Solana POC completed successfully\n");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n✗ Error occurred:");
      console.error(error);
      process.exit(1);
    });
}
