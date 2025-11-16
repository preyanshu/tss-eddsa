/**
 * Complete MPC Protocol Example
 * 
 * This example demonstrates the full Multi-Party Computation (MPC) protocol
 * for threshold EdDSA signatures, including:
 * 
 * 1. Key Generation Phase:
 *    - Party registration
 *    - Commitment generation
 *    - Secret share distribution
 *    - Shared keypair construction
 *    - Aggregate public key generation
 * 
 * 2. Signing Phase:
 *    - Ephemeral key generation
 *    - Ephemeral commitment and share distribution
 *    - Ephemeral keypair construction
 *    - Local signature computation
 *    - Signature aggregation and verification
 * 
 * Architecture:
 * - Each party runs an MPCService on their own server
 * - A CoordinatorService orchestrates the protocol
 * - Services communicate via HTTP APIs (simulated in this example)
 * 
 * Usage:
 *   npm run example:mpc -- 2 3 party-0,party-1
 * 
 * Arguments:
 *   threshold (default: 2) - Minimum parties needed to sign
 *   totalParties (default: 3) - Total number of parties
 *   signingParties (default: party-0,party-1) - Comma-separated party IDs to sign
 */

import { MPCService, CoordinatorService } from '../dist/index';
import { SignatureResult } from '../src/types';
import { validateThreshold, validateSigningParties } from '../src/utils/validation';

/**
 * Run the complete MPC protocol demonstration
 */
export async function runCompleteMPCProtocol(
    threshold: number = 2,
    totalParties: number = 3,
    signingParties: string[] = ['party-0', 'party-1']
): Promise<SignatureResult> {
    // ============================================
    // INPUT VALIDATION
    // ============================================
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     Complete MPC Protocol Demonstration                      ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    validateThreshold(threshold, totalParties);
    validateSigningParties(signingParties.length, threshold, totalParties);
    
    console.log(`Configuration: (t=${threshold}, n=${totalParties}) threshold signature`);
    console.log(`Signing parties: ${signingParties.length} (${signingParties.join(', ')})\n`);
    
    // Generate all party IDs
    const allPartyIds = Array.from({ length: totalParties }, (_, i) => `party-${i}`);
    console.log('Architecture Overview:');
    allPartyIds.forEach(partyId => {
        console.log(`  • MPC Service ${partyId}:   http://${partyId}-server:3000`);
    });
    console.log('  • Coordinator Service:    http://coordinator-server:3000\n');

    // ============================================
    // SETUP: Initialize Services
    // ============================================
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│ SETUP: Initializing Services                                 │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');
    
    // In production, each service runs on a separate server
    const services: { [key: string]: MPCService } = {};
    for (const partyId of allPartyIds) {
        services[partyId] = new MPCService(partyId);
    }
    
    const coordinator = new CoordinatorService();
    console.log('✓ All services initialized\n');

    // ============================================
    // PHASE 1: KEY GENERATION
    // ============================================
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│ PHASE 1: KEY GENERATION                                       │');
    console.log('│                                                              │');
    console.log('│ This phase establishes a shared secret key across all       │');
    console.log('│ parties without any single party knowing the full key.      │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    // Step 1: Coordinator starts key generation session
    console.log('Step 1: Coordinator starts key generation session');
    console.log('  [Coordinator] POST /api/keygen/start');
    console.log(`    Body: { threshold: ${threshold}, totalParties: ${totalParties} }`);
    coordinator.startKeyGeneration(threshold, totalParties);
    console.log('  ✓ Session started\n');

    // Step 2: Parties register with coordinator
    console.log('Step 2: MPC Services register with coordinator');
    console.log('  Each party generates their initial public key and registers');
    const partyInits: { [key: string]: any } = {};
    
    for (const partyId of allPartyIds) {
        console.log(`  [${partyId}] POST http://coordinator-server:3000/api/keygen/register`);
        partyInits[partyId] = services[partyId].register();
        coordinator.registerParty(partyId, partyInits[partyId].publicKey);
        const partyIndex = (coordinator as any).parties.findIndex((p: any) => p.partyId === partyId);
        console.log(`    Response: { partyId: "${partyId}", partyIndex: ${partyIndex} }`);
    }
    console.log('  ✓ All parties registered\n');

    // Step 3: Coordinator collects commitments
    console.log('Step 3: Coordinator requests commitments from all parties');
    console.log('  Commitments are used to ensure parties cannot cheat during share distribution');
    const partyCommitments: Array<{ partyId: string; commitment: any; blindFactor: any }> = [];
    for (const partyId of allPartyIds) {
        console.log(`  [${partyId}] POST /api/mpc/keygen/commitment`);
        const commit = services[partyId].generateCommitment();
        partyCommitments.push({ partyId, ...commit });
    }
    
    const commitData = coordinator.collectCommitments(partyCommitments);
    console.log('  ✓ Commitments collected from all parties\n');

    // Step 4: Coordinator collects secret shares
    console.log('Step 4: Coordinator requests secret shares from all parties');
    console.log('  Each party distributes shares of their secret to all other parties');
    const partyShares: Array<{ partyId: string; vss: any; secretShares: any[] }> = [];
    for (let i = 0; i < allPartyIds.length; i++) {
        const partyId = allPartyIds[i];
        console.log(`  [${partyId}] POST /api/mpc/keygen/distribute`);
        console.log(`    Body: { threshold: ${commitData.threshold}, shareCount: ${commitData.shareCount}, partyIndex: ${commitData.parties[i]} }`);
        const shares = services[partyId].distributeShares(
            commitData.threshold,
            commitData.shareCount,
            commitData.blindFactors,
            commitData.publicKeys,
            commitData.commitments,
            commitData.parties[i]
        );
        partyShares.push({ partyId, ...shares });
    }
    
    const shareData = coordinator.collectShares(partyShares);
    console.log('  ✓ Secret shares collected from all parties\n');

    // Step 5: Parties construct their shared keypairs
    console.log('Step 5: Coordinator requests keypair construction from all parties');
    console.log('  Each party constructs their shared keypair from collected shares');
    const partySharedKeys: Array<{ partyId: string; sharedKey: any }> = [];
    for (const partyId of allPartyIds) {
        console.log(`  [${partyId}] POST /api/mpc/keygen/construct`);
        const keyResult = services[partyId].constructKeypair(
            shareData[partyId].threshold,
            shareData[partyId].shareCount,
            shareData[partyId].publicKeys,
            shareData[partyId].allSecretShares,
            shareData[partyId].allVssSchemes,
            shareData[partyId].partyIndex
        );
        partySharedKeys.push({ partyId, sharedKey: keyResult.sharedKey });
    }
    
    const keygenResult = coordinator.collectSharedKeys(partySharedKeys);
    console.log('  ✓ Shared keypairs constructed');
    console.log(`  Aggregate Public Key: ${keygenResult.aggregatePublicKeyHex.substring(0, 64)}...\n`);

    // ============================================
    // PHASE 2: SIGNING
    // ============================================
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│ PHASE 2: SIGNING                                             │');
    console.log('│                                                              │');
    console.log('│ This phase creates a threshold signature where at least     │');
    console.log('│ `threshold` parties must participate to sign a message.     │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');

    const message = Buffer.from('Hello, Threshold Signatures!');
    console.log(`Message to sign: "${message.toString()}"\n`);

    // Step 1: Coordinator starts signing session
    console.log('Step 1: Coordinator starts signing session');
    console.log(`  [Coordinator] POST /api/sign/start`);
    console.log(`    Body: { message: Buffer, signingParties: [${signingParties.map(p => `"${p}"`).join(', ')}] }`);
    const signingSession = coordinator.startSigning(message, signingParties);
    console.log(`  ✓ Signing session started (${signingParties.length} signers)\n`);

    // Step 2: Generate ephemeral keys and commitments
    console.log('Step 2: Coordinator requests ephemeral keys and commitments');
    console.log('  Ephemeral keys are one-time keys used only for this signature');
    const partyEphData: Array<{ partyId: string; ephR: any; ephKeyId: string; commitment: any; blindFactor: any }> = [];
    for (let i = 0; i < signingParties.length; i++) {
        const partyId = signingParties[i];
        console.log(`  [${partyId}] POST /api/mpc/sign/ephemeral-key`);
        const eph = services[partyId].startEphemeralKeyGeneration(message, signingSession.signingParties[i]);
        partyEphData.push({ partyId, ...eph });
    }
    
    const ephCommitData = coordinator.collectEphemeralKeysAndCommitments(partyEphData);
    console.log('  ✓ Ephemeral keys and commitments collected\n');

    // Step 3: Distribute ephemeral shares
    console.log('Step 3: Coordinator requests ephemeral shares from signing parties');
    const signingShareCount = signingParties.length;
    const signingThreshold = threshold;
    
    const partyEphShares: Array<{ partyId: string; vss: any; secretShares: any[] }> = [];
    for (let i = 0; i < signingParties.length; i++) {
        const partyId = signingParties[i];
        const eph = partyEphData[i];
        console.log(`  [${partyId}] POST /api/mpc/sign/distribute-ephemeral`);
        const shares = services[partyId].distributeEphemeralShares(
            eph.ephKeyId,
            signingThreshold,
            signingShareCount,
            ephCommitData.ephBlindFactors,
            ephCommitData.ephRPoints,
            ephCommitData.ephCommitments,
            signingSession.signingParties
        );
        partyEphShares.push({ partyId, ...shares });
    }
    
    const ephShareData = coordinator.collectEphemeralShares(partyEphShares);
    console.log('  ✓ Ephemeral shares collected\n');

    // Step 4: Construct ephemeral keypairs
    console.log('Step 4: Coordinator requests ephemeral keypair construction');
    const ephSharedKeys: any[] = [];
    for (let i = 0; i < signingParties.length; i++) {
        const partyId = signingParties[i];
        const eph = partyEphData[i];
        console.log(`  [${partyId}] POST /api/mpc/sign/construct-ephemeral`);
        const ephResult = services[partyId].constructEphemeralKeypair(
            eph.ephKeyId,
            signingThreshold,
            signingShareCount,
            ephCommitData.ephRPoints,
            ephShareData[partyId].allEphSecretShares,
            ephShareData[partyId].allEphVssSchemes,
            ephShareData[partyId].partyIndex,
            signingSession.signingParties
        );
        ephSharedKeys.push(ephResult.ephSharedKey);
    }
    
    // Set coordinator state for ephemeral keys
    (coordinator as any).ephSharedKeys = ephSharedKeys;
    (coordinator as any).allEphVssSchemes = ephShareData[signingParties[0]].allEphVssSchemes;
    (coordinator as any).allVssSchemes = shareData[allPartyIds[0]].allVssSchemes;
    (coordinator as any).signingPartyIndices = signingSession.signingParties;
    
    console.log('  ✓ Ephemeral keypairs constructed\n');

    // Step 5: Compute and aggregate local signatures
    console.log('Step 5: Coordinator requests local signatures from signing parties');
    const partyLocalSigs: Array<{ partyId: string; localSig: any }> = [];
    for (let i = 0; i < signingParties.length; i++) {
        const partyId = signingParties[i];
        console.log(`  [${partyId}] POST /api/mpc/sign/compute-local`);
        const localSigResult = services[partyId].computeLocalSignature(message, ephSharedKeys[i]);
        partyLocalSigs.push({ partyId, localSig: localSigResult.localSig });
    }
    
    const result = coordinator.collectLocalSignatures(partyLocalSigs);
    console.log('  ✓ Local signatures computed and aggregated\n');

    // ============================================
    // RESULTS
    // ============================================
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│ RESULTS                                                      │');
    console.log('└──────────────────────────────────────────────────────────────┘\n');
    
    const sigR = result.signature.r || (result.signature as any).R;
    const sigS = result.signature.s || (result.signature as any).S;
    const sigRHex = Buffer.from(sigR.bytes).toString('hex');
    const sigSHex = Buffer.from(sigS.bytes).toString('hex');
    
    console.log('Signature Components:');
    console.log(`  R: ${sigRHex.substring(0, 32)}...`);
    console.log(`  s: ${sigSHex.substring(0, 32)}...`);
    console.log(`\nVerification: ${result.isValid ? '✓ VALID' : '✗ INVALID'}`);
    console.log(`\nFull Signature (hex): ${result.signatureHex.substring(0, 64)}...`);
    console.log(`Aggregate Public Key (hex): ${result.aggregatePublicKeyHex.substring(0, 64)}...\n`);

    return result;
}

// Run the example if executed directly
if (require.main === module) {
    const args = process.argv.slice(2);
    const threshold = args[0] ? parseInt(args[0], 10) : 2;
    const totalParties = args[1] ? parseInt(args[1], 10) : 3;
    const defaultSigningParties = Array.from({ length: threshold }, (_, i) => `party-${i}`);
    const signingPartiesArg = args[2] ? args[2].split(',') : defaultSigningParties;
    
    runCompleteMPCProtocol(threshold, totalParties, signingPartiesArg)
        .then(() => {
            console.log('✓ Example completed successfully\n');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n✗ Error occurred:');
            console.error(error);
            process.exit(1);
        });
}

