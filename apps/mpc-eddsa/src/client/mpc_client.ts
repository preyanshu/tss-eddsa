import * as thresholdSigModule from "multi-party-eddsa-node";
const thresholdSig = thresholdSigModule.threshold_sig;

import { ValidationError } from "../errors";
import {
  SerializableBigInt,
  PublicKey,
  SecretShare,
  VSSScheme,
  SharedKey,
  EphemeralSharedKey,
  LocalSignature,
  Signature,
  KeyGenResult,
  CommitmentResult,
  ShareDistributionResult,
  EphemeralKeyResult,
  EphemeralCommitmentResult,
  AggregateKeyResult,
} from "../types";

/**
 * Stateless MPC Client for Threshold Signatures
 *
 * This class provides a simplified interface for multi-party threshold signatures.
 * All methods are stateless - they accept all necessary data as parameters and
 * return the data needed for the next step.
 */
export class MPCClient {
  /**
   * Helper: Adjust threshold for Rust calls (t-1)
   * Rust requires signingParties.length > threshold, so we pass t-1 to allow t signers
   */
  private static _adjustThresholdForRust(userThreshold: number): number {
    if (userThreshold < 2) {
      throw new ValidationError(
        `Threshold must be at least 2. Got ${userThreshold}. This is required because we pass t-1 to Rust, and t-1 must be >= 1.`,
      );
    }
    return userThreshold - 1;
  }

  /**
   * Step 1: Create public key for a party
   */
  static createPubKey(partyIndex: number): KeyGenResult {
    const keyId: string = thresholdSig.phase1Create(partyIndex);
    const publicKey: PublicKey = thresholdSig.getPublicKey(keyId);
    return {
      keyId,
      publicKey,
    };
  }

  /**
   * Step 2: Generate commitment for key generation (Phase 1 Broadcast)
   */
  static generateCommitment(keyId: string): CommitmentResult {
    const broadcast = thresholdSig.phase1Broadcast(keyId);
    return {
      commitment: broadcast.commitment,
      blindFactor: broadcast.blind_factor,
    };
  }

  /**
   * Step 3: Distribute secret shares (Phase 1 Verify and Phase 2 Distribute)
   */
  static distributeShares(
    keyId: string,
    threshold: number,
    shareCount: number,
    blindFactors: SerializableBigInt[],
    publicKeys: SerializableBigInt[],
    commitments: SerializableBigInt[],
    _partyIndex: number,
  ): ShareDistributionResult {
    // Adjust threshold for Rust: pass t-1 so that threshold=t works with t signers
    const rustThreshold = this._adjustThresholdForRust(threshold);

    // Convert to 1-indexed for VSS (parties are 1-indexed internally)
    const parties = Array.from({ length: shareCount }, (_, i) => i + 1);

    // Convert to number[] arrays for Rust bindings
    const blindFactorsArray = blindFactors.map((bf) => ({
      bytes: Array.isArray(bf.bytes) ? bf.bytes : Array.from(bf.bytes),
    }));
    const publicKeysArray = publicKeys.map((pk) => ({
      bytes: Array.isArray(pk.bytes) ? pk.bytes : Array.from(pk.bytes),
    }));
    const commitmentsArray = commitments.map((c) => ({
      bytes: Array.isArray(c.bytes) ? c.bytes : Array.from(c.bytes),
    }));

    const result = thresholdSig.phase1VerifyComPhase2Distribute(
      keyId,
      rustThreshold,
      shareCount,
      blindFactorsArray,
      publicKeysArray,
      commitmentsArray,
      parties,
    );

    // Normalize VSS structure
    const vss: VSSScheme = result.vss;
    if (vss.share_count !== undefined && vss.shareCount === undefined) {
      vss.shareCount = vss.share_count;
    }

    return {
      vss,
      secretShares: result.secret_shares,
    };
  }

  /**
   * Step 4: Construct shared keypair (Phase 2 Verify and Construct Keypair)
   */
  static constructKeypair(
    keyId: string,
    threshold: number,
    shareCount: number,
    publicKeys: SerializableBigInt[],
    allSecretShares: SecretShare[][],
    allVssSchemes: VSSScheme[],
    partyIndex: number,
  ): SharedKey {
    // Adjust threshold for Rust: pass t-1 so that threshold=t works with t signers
    const rustThreshold = this._adjustThresholdForRust(threshold);

    // Collect secret shares for this party from all parties
    // allSecretShares[j] contains shares distributed by party j
    // allSecretShares[j][partyIndex] is the share that party j gave to this party
    const partySecretShares: SecretShare[] = [];
    for (let j = 0; j < shareCount; j++) {
      partySecretShares.push(allSecretShares[j][partyIndex]);
    }

    // Convert to 1-indexed for VSS
    const vssPartyIndex = partyIndex + 1;

    // Convert to number[] arrays for Rust bindings
    const publicKeysArray = publicKeys.map((pk) => ({
      bytes: Array.isArray(pk.bytes) ? pk.bytes : Array.from(pk.bytes),
    }));
    const partySecretSharesArray = partySecretShares.map((share) => ({
      bytes: Array.isArray(share.bytes) ? share.bytes : Array.from(share.bytes),
    }));

    // VSS schemes need to match Rust type - they should already be compatible
    const sharedKey: SharedKey = thresholdSig.phase2VerifyVssConstructKeypair(
      keyId,
      rustThreshold,
      shareCount,
      publicKeysArray,
      partySecretSharesArray,
      allVssSchemes as any, // VSSScheme should be compatible with SerializableVerifiableSs
      vssPartyIndex,
    );

    return sharedKey;
  }

  /**
   * Aggregate public keys from all parties
   */
  static aggregateKey(sharedKeys: SharedKey[]): AggregateKeyResult {
    // All shared keys have the same aggregate public key (y)
    // Return the first one's public key as the aggregate
    if (!sharedKeys || sharedKeys.length === 0) {
      throw new ValidationError("No shared keys provided");
    }
    return {
      aggregatePublicKey: sharedKeys[0].y,
      sharedKeys: sharedKeys,
    };
  }

  /**
   * Step 5: Create ephemeral key for signing
   */
  static createEphemeralKey(
    keyId: string,
    message: Buffer | number[],
    partyIndex: number,
  ): EphemeralKeyResult {
    const messageArray = Buffer.isBuffer(message)
      ? Array.from(message)
      : message;
    const ephKeyId: string = thresholdSig.ephemeralKeyCreate(
      keyId,
      messageArray,
      partyIndex,
    );
    const ephR: SerializableBigInt = thresholdSig.getEphemeralR(ephKeyId);
    return {
      ephKeyId,
      ephR,
    };
  }

  /**
   * Step 6: Generate ephemeral commitment (Ephemeral Phase 1 Broadcast)
   */
  static generateEphemeralCommitment(
    ephKeyId: string,
  ): EphemeralCommitmentResult {
    const ephBroadcast = thresholdSig.ephemeralPhase1Broadcast(ephKeyId);
    return {
      commitment: ephBroadcast.commitment,
      blindFactor: ephBroadcast.blind_factor,
    };
  }

  /**
   * Step 7: Distribute ephemeral secret shares (Ephemeral Phase 1 Verify and Phase 2 Distribute)
   */
  static distributeEphemeralShares(
    ephKeyId: string,
    threshold: number,
    shareCount: number,
    ephBlindFactors: SerializableBigInt[],
    ephRPoints: SerializableBigInt[],
    ephCommitments: SerializableBigInt[],
    signingParties: number[],
  ): ShareDistributionResult {
    // Adjust threshold for Rust: pass t-1 so that threshold=t works with t signers
    const rustThreshold = this._adjustThresholdForRust(threshold);

    // Convert to 1-indexed for VSS
    const signingPartiesVSS = signingParties.map((p) => p + 1);

    // Convert to number[] arrays for Rust bindings
    const ephBlindFactorsArray = ephBlindFactors.map((bf) => ({
      bytes: Array.isArray(bf.bytes) ? bf.bytes : Array.from(bf.bytes),
    }));
    const ephRPointsArray = ephRPoints.map((r) => ({
      bytes: Array.isArray(r.bytes) ? r.bytes : Array.from(r.bytes),
    }));
    const ephCommitmentsArray = ephCommitments.map((c) => ({
      bytes: Array.isArray(c.bytes) ? c.bytes : Array.from(c.bytes),
    }));

    const ephResult = thresholdSig.ephemeralPhase1VerifyComPhase2Distribute(
      ephKeyId,
      rustThreshold,
      shareCount,
      ephBlindFactorsArray,
      ephRPointsArray,
      ephCommitmentsArray,
      signingPartiesVSS,
    );

    // Normalize VSS structure
    const ephVss: VSSScheme = ephResult.vss;
    if (ephVss.share_count !== undefined && ephVss.shareCount === undefined) {
      ephVss.shareCount = ephVss.share_count;
    }

    return {
      vss: ephVss,
      secretShares: ephResult.secret_shares,
    };
  }

  /**
   * Step 8: Construct ephemeral shared keypair (Ephemeral Phase 2 Verify and Construct Keypair)
   */
  static constructEphemeralKeypair(
    ephKeyId: string,
    threshold: number,
    shareCount: number,
    ephRPoints: SerializableBigInt[],
    allEphSecretShares: SecretShare[][],
    allEphVssSchemes: VSSScheme[],
    partyIndex: number,
    signingParties: number[],
  ): EphemeralSharedKey {
    // Adjust threshold for Rust: pass t-1 so that threshold=t works with t signers
    const rustThreshold = this._adjustThresholdForRust(threshold);

    // Find the index of this party in the signing parties array
    const signingPartyIdx = signingParties.indexOf(partyIndex);
    if (signingPartyIdx === -1) {
      throw new ValidationError(
        `Party ${partyIndex} is not in the signing parties list`,
      );
    }

    // Collect ephemeral secret shares for this party from all signing parties
    const partyEphSecretShares: SecretShare[] = [];
    for (let j = 0; j < signingParties.length; j++) {
      partyEphSecretShares.push(allEphSecretShares[j][partyIndex]);
    }

    // Convert to 1-indexed for VSS
    const vssPartyIndex = partyIndex + 1;

    // Convert to number[] arrays for Rust bindings
    const ephRPointsArray = ephRPoints.map((r) => ({
      bytes: Array.isArray(r.bytes) ? r.bytes : Array.from(r.bytes),
    }));
    const partyEphSecretSharesArray = partyEphSecretShares.map((share) => ({
      bytes: Array.isArray(share.bytes) ? share.bytes : Array.from(share.bytes),
    }));

    const ephSharedKey: EphemeralSharedKey =
      thresholdSig.ephemeralPhase2VerifyVssConstructKeypair(
        ephKeyId,
        rustThreshold,
        shareCount,
        ephRPointsArray,
        partyEphSecretSharesArray,
        allEphVssSchemes as any, // VSSScheme should be compatible with SerializableVerifiableSs
        vssPartyIndex,
      );

    return ephSharedKey;
  }

  /**
   * Step 9: Compute local signature
   */
  static computeLocalSignature(
    message: Buffer | number[],
    ephSharedKey: EphemeralSharedKey,
    sharedKey: SharedKey,
  ): LocalSignature {
    const messageArray = Buffer.isBuffer(message)
      ? Array.from(message)
      : message;
    // Convert to Rust-compatible format
    const ephSharedKeyRust = {
      r: {
        bytes: Array.isArray(ephSharedKey.r.bytes)
          ? ephSharedKey.r.bytes
          : Array.from(ephSharedKey.r.bytes),
      },
      rI: {
        bytes: Array.isArray(ephSharedKey.rI.bytes)
          ? ephSharedKey.rI.bytes
          : Array.from(ephSharedKey.rI.bytes),
      },
    };
    const sharedKeyRust = {
      y: {
        bytes: Array.isArray(sharedKey.y.bytes)
          ? sharedKey.y.bytes
          : Array.from(sharedKey.y.bytes),
      },
      xI: {
        bytes: Array.isArray(sharedKey.xI.bytes)
          ? sharedKey.xI.bytes
          : Array.from(sharedKey.xI.bytes),
      },
      prefix: sharedKey.prefix
        ? {
            bytes: Array.isArray(sharedKey.prefix.bytes)
              ? sharedKey.prefix.bytes
              : Array.from(sharedKey.prefix.bytes),
          }
        : undefined,
    };
    const localSig: LocalSignature = thresholdSig.computeLocalSig(
      messageArray,
      ephSharedKeyRust as any,
      sharedKeyRust as any,
    );
    return localSig;
  }

  /**
   * Step 10: Verify local signatures
   */
  static verifyLocalSignatures(
    localSigs: LocalSignature[],
    signingParties: number[],
    keyGenVssSchemes: VSSScheme[],
    ephVssSchemes: VSSScheme[],
  ): any {
    // Convert to Rust-compatible format
    const localSigsRust = localSigs.map((sig) => ({
      gammaI: {
        bytes: Array.isArray(sig.gammaI.bytes)
          ? sig.gammaI.bytes
          : Array.from(sig.gammaI.bytes),
      },
      k: {
        bytes: Array.isArray(sig.k.bytes)
          ? sig.k.bytes
          : Array.from(sig.k.bytes),
      },
    }));
    const vssSum = thresholdSig.verifyLocalSigs(
      localSigsRust as any,
      signingParties,
      keyGenVssSchemes as any,
      ephVssSchemes as any,
    );
    return vssSum;
  }

  /**
   * Step 11: Generate final aggregated signature
   */
  static aggregateSignature(
    vssSum: any,
    localSigs: LocalSignature[],
    signingParties: number[],
    aggregateR: SerializableBigInt,
  ): Signature {
    // Convert to Rust-compatible format
    const localSigsRust = localSigs.map((sig) => ({
      gammaI: {
        bytes: Array.isArray(sig.gammaI.bytes)
          ? sig.gammaI.bytes
          : Array.from(sig.gammaI.bytes),
      },
      k: {
        bytes: Array.isArray(sig.k.bytes)
          ? sig.k.bytes
          : Array.from(sig.k.bytes),
      },
    }));
    const aggregateRRust = {
      bytes: Array.isArray(aggregateR.bytes)
        ? aggregateR.bytes
        : Array.from(aggregateR.bytes),
    };
    const signature: Signature = thresholdSig.generateSignature(
      vssSum,
      localSigsRust as any,
      signingParties,
      aggregateRRust,
    );
    return signature;
  }

  /**
   * Verify a signature
   */
  static verifySignature(
    signature: Signature,
    message: Buffer | number[],
    aggregatePublicKey: PublicKey,
  ): boolean {
    const messageArray = Buffer.isBuffer(message)
      ? Array.from(message)
      : message;
    // Convert to Rust-compatible format
    const signatureRust = {
      r: {
        bytes: Array.isArray(signature.r.bytes)
          ? signature.r.bytes
          : Array.from(signature.r.bytes),
      },
      s: {
        bytes: Array.isArray(signature.s.bytes)
          ? signature.s.bytes
          : Array.from(signature.s.bytes),
      },
    };
    const aggregatePublicKeyRust = {
      bytes: Array.isArray(aggregatePublicKey.bytes)
        ? aggregatePublicKey.bytes
        : Array.from(aggregatePublicKey.bytes),
    };
    const isValid: boolean = thresholdSig.verifySignature(
      signatureRust as any,
      messageArray,
      aggregatePublicKeyRust,
    );
    return isValid;
  }
}
