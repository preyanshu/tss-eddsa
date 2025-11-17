import { MPCClient } from "../client/mpc_client";
import {
  SerializableBigInt,
  PublicKey,
  Party,
  KeyGenSession,
  SigningSession,
  VSSScheme,
  SecretShare,
  SharedKey,
  EphemeralSharedKey,
  LocalSignature,
  SignatureResult,
  PartyRegistrationResponse,
  CommitData,
  ShareData,
  EphemeralCommitData,
  EphemeralShareData,
} from "../types";
import * as serialization from "../utils/serialization";
import { validateThreshold, validateSigningParties } from "../utils/validation";
import { SessionError, PartyError, StateError } from "../errors";

/**
 * Coordinator Service - Orchestrates the MPC protocol
 *
 * This runs on a separate coordinator server.
 * It doesn't have access to any private keys.
 * It orchestrates communication between MPC services.
 *
 * @example
 * const CoordinatorService = require('multi-party-eddsa/CoordinatorService');
 * const coordinator = new CoordinatorService();
 * coordinator.startKeyGeneration(2, 4);
 */
export class CoordinatorService {
  private session: KeyGenSession | null = null;
  private parties: Party[] = [];
  private commitments: SerializableBigInt[] = [];
  private blindFactors: SerializableBigInt[] = [];
  private allVssSchemes: VSSScheme[] = [];
  private allSecretShares: SecretShare[][] = [];
  private sharedKeys: SharedKey[] = [];
  private signingSession?: SigningSession;
  private signingPartyIndices?: number[];
  private ephRPoints?: SerializableBigInt[];
  private ephCommitments?: SerializableBigInt[];
  private ephBlindFactors?: SerializableBigInt[];
  private allEphVssSchemes?: VSSScheme[];
  private allEphSecretShares?: SecretShare[][];
  private ephSharedKeys?: EphemeralSharedKey[];
  private aggregatePublicKey?: PublicKey;

  constructor() {}

  /**
   * Initialize key generation session
   * @param {number} threshold - Minimum number of parties needed to sign
   * @param {number} totalParties - Total number of parties
   * @returns {Object} - Session object
   */
  startKeyGeneration(threshold: number, totalParties: number): KeyGenSession {
    // Validate threshold
    validateThreshold(threshold, totalParties);

    this.session = {
      threshold,
      totalParties,
      phase: "keygen",
    };
    this.parties = [];
    this.commitments = [];
    this.blindFactors = [];
    this.allVssSchemes = [];
    this.allSecretShares = [];
    this.sharedKeys = [];

    return this.session;
  }

  /**
   * Step 1: Register parties for key generation
   * Each MPC service calls this to register
   * Accepts publicKey in any format (Array or Buffer bytes) - handles conversion automatically
   * @param {string} partyId - Party identifier
   * @param {Object} publicKey - Public key object (bytes can be Array or Buffer)
   * @returns {Object} - { partyIndex, totalParties }
   */
  registerParty(
    partyId: string,
    publicKey: SerializableBigInt
  ): PartyRegistrationResponse {
    if (!this.session) {
      throw new SessionError(
        "Session not initialized. Call startKeyGeneration() first"
      );
    }

    // Normalize publicKey bytes to Buffer for internal storage
    const normalizedPublicKey = serialization.normalizeBytesToBuffer(publicKey);

    // Determine party index (deterministic from partyId)
    const partyIndex = this._getPartyIndexFromId(partyId);

    this.parties.push({
      partyId,
      publicKey: normalizedPublicKey,
      partyIndex,
    });

    // Sort parties by partyId for consistent ordering
    this.parties.sort((a, b) => a.partyId.localeCompare(b.partyId));

    // Update party indices based on sorted order
    this.parties.forEach((p, idx) => {
      p.protocolIndex = idx;
    });

    const party = this.parties.find((p) => p.partyId === partyId);
    if (!party || party.protocolIndex === undefined) {
      throw new PartyError(
        `Party ${partyId} not found or protocolIndex not set`
      );
    }
    return {
      partyIndex: party.protocolIndex,
      totalParties: this.parties.length,
    };
  }

  /**
   * Step 2: Collect commitments from all parties
   * Returns data needed for each party to distribute shares
   * Accepts commitments in any format (Array or Buffer bytes) - handles conversion automatically
   * Returns data in HTTP format (Array bytes) for easy use
   * @param {Array} partyCommitments - Array of { partyId, commitment, blindFactor } (bytes can be Array or Buffer)
   * @returns {Object} - Commit data in HTTP format (bytes as Array)
   */
  collectCommitments(
    partyCommitments: Array<{
      partyId: string;
      commitment: SerializableBigInt;
      blindFactor: SerializableBigInt;
    }>
  ): CommitData {
    // partyCommitments: [{ partyId, commitment, blindFactor }, ...]
    this.commitments = [];
    this.blindFactors = [];

    // Sort by partyId to match party order
    const sorted = partyCommitments.sort((a, b) =>
      a.partyId.localeCompare(b.partyId)
    );

    // Normalize to Buffer for internal storage
    for (const commit of sorted) {
      this.commitments.push(
        serialization.normalizeBytesToBuffer(commit.commitment)
      );
      this.blindFactors.push(
        serialization.normalizeBytesToBuffer(commit.blindFactor)
      );
    }

    // Return HTTP format (Array bytes)
    if (!this.session) {
      throw new SessionError("Session not initialized");
    }
    return {
      threshold: this.session.threshold,
      shareCount: this.session.totalParties,
      blindFactors: this.blindFactors.map((bf) =>
        serialization.serializeForHttp(bf)
      ),
      publicKeys: this.parties.map((p) =>
        serialization.serializeForHttp(p.publicKey)
      ),
      commitments: this.commitments.map((c) =>
        serialization.serializeForHttp(c)
      ),
      parties: this.parties.map((p) => p.protocolIndex || 0),
    };
  }

  /**
   * Step 3: Collect secret shares from all parties
   * Returns data needed for each party to construct keypair
   * Accepts shares in any format (Array or Buffer bytes) - handles conversion automatically
   * Returns data in HTTP format (Array bytes) for easy use
   * @param {Array} partyShares - Array of { partyId, vss, secretShares } (bytes can be Array or Buffer)
   * @returns {Object} - Key construction data by party ID in HTTP format (bytes as Array)
   */
  collectShares(
    partyShares: Array<{
      partyId: string;
      vss: VSSScheme;
      secretShares: SecretShare[];
    }>
  ): ShareData {
    // partyShares: [{ partyId, vss, secretShares }, ...]
    this.allVssSchemes = [];
    this.allSecretShares = [];

    // Sort by partyId
    const sorted = partyShares.sort((a, b) =>
      a.partyId.localeCompare(b.partyId)
    );

    // Normalize secretShares to Buffer for internal storage
    for (const share of sorted) {
      this.allVssSchemes.push(share.vss);
      this.allSecretShares.push(
        share.secretShares.map((s) => serialization.normalizeBytesToBuffer(s))
      );
    }

    // Return data for each party to construct their keypair in HTTP format
    if (!this.session) {
      throw new SessionError("Session not initialized");
    }
    const shareCount = this.parties.length;
    const threshold = this.session.threshold;

    const result: ShareData = {};
    for (let i = 0; i < shareCount; i++) {
      const party = this.parties[i];
      if (!party) {
        throw new PartyError(`Party at index ${i} is undefined`);
      }
      if (party.protocolIndex === undefined) {
        throw new PartyError(`Party ${party.partyId} has no protocolIndex`);
      }

      result[party.partyId] = {
        threshold,
        shareCount,
        publicKeys: this.parties.map((p) =>
          serialization.serializeForHttp(p.publicKey)
        ),
        allSecretShares: serialization.serialize2DArrayForHttp(
          this.allSecretShares
        ),
        allVssSchemes: this.allVssSchemes,
        partyIndex: party.protocolIndex,
      };
    }

    return result;
  }

  /**
   * Step 4: Collect shared keys and compute aggregate public key
   * Accepts sharedKeys in any format (Array or Buffer bytes) - handles conversion automatically
   * Returns data in HTTP format (Array bytes) for easy use
   * @param {Array} partySharedKeys - Array of { partyId, sharedKey } (bytes can be Array or Buffer)
   * @returns {Object} - { aggregatePublicKey: {bytes: Array}, aggregatePublicKeyHex, sharedKeys } in HTTP format
   */
  collectSharedKeys(
    partySharedKeys: Array<{ partyId: string; sharedKey: SharedKey }>
  ): {
    aggregatePublicKey: SerializableBigInt;
    aggregatePublicKeyHex: string;
    sharedKeys: SharedKey[];
  } {
    // partySharedKeys: [{ partyId, sharedKey }, ...]
    this.sharedKeys = [];

    // Sort by partyId
    const sorted = partySharedKeys.sort((a, b) =>
      a.partyId.localeCompare(b.partyId)
    );

    // Normalize sharedKeys to Buffer for internal storage and Rust calls
    for (const sk of sorted) {
      this.sharedKeys.push({
        y: serialization.normalizeBytesToBuffer(sk.sharedKey.y),
        xI: serialization.normalizeBytesToBuffer(sk.sharedKey.xI),
        prefix: sk.sharedKey.prefix
          ? serialization.normalizeBytesToBuffer(sk.sharedKey.prefix)
          : undefined,
      });
    }

    // Compute aggregate public key
    const { aggregatePublicKey } = MPCClient.aggregateKey(this.sharedKeys);
    const aggregatePublicKeyHex = Buffer.from(
      aggregatePublicKey.bytes
    ).toString("hex");

    // Store for later use in signing (keep as Buffer internally)
    this.aggregatePublicKey = aggregatePublicKey;

    // Return HTTP format (Array bytes)
    return {
      aggregatePublicKey: serialization.serializeForHttp(aggregatePublicKey),
      aggregatePublicKeyHex,
      sharedKeys: this.sharedKeys.map((sk) => ({
        y: serialization.serializeForHttp(sk.y),
        xI: serialization.serializeForHttp(sk.xI),
        prefix: sk.prefix
          ? serialization.serializeForHttp(sk.prefix)
          : undefined,
      })),
    };
  }

  /**
   * Start signing session
   * Accepts message in any format (Buffer, Array, or string) - handles conversion automatically
   * @param {Buffer|Array|string} message - Message to sign (any format)
   * @param {Array<string>} signingParties - Array of party IDs that will sign
   * @returns {Object} - Signing session info
   */
  startSigning(
    message: Buffer | number[] | string,
    signingParties: string[]
  ): {
    message: Buffer;
    signingParties: number[];
  } {
    // signingParties: ['alice', 'bob', ...]
    if (!this.session) {
      throw new StateError("Key generation not completed");
    }

    // Validate that number of signers is >= threshold (user's threshold)
    if (signingParties.length < this.session.threshold) {
      validateSigningParties(
        signingParties.length,
        this.session.threshold,
        this.session.totalParties
      );
    }

    // Normalize message to Buffer for internal storage
    const messageBuffer = serialization.normalizeMessage(message);

    this.signingSession = {
      message: messageBuffer,
      signingParties: signingParties.sort(),
      phase: "signing",
    };

    // Map signing party IDs to protocol indices
    this.signingPartyIndices = signingParties
      .map((pid) => {
        const party = this.parties.find((p) => p.partyId === pid);
        if (!party || party.protocolIndex === undefined) {
          throw new Error(`Party ${pid} not found or protocolIndex not set`);
        }
        return party.protocolIndex;
      })
      .sort();

    return {
      message: messageBuffer,
      signingParties: this.signingPartyIndices,
    };
  }

  /**
   * Collect ephemeral keys
   * @param {Array} partyEphKeys - Array of { partyId, ephR }
   * @returns {Object} - { ephRPoints, signingPartyIndices }
   */
  collectEphemeralKeys(
    partyEphKeys: Array<{ partyId: string; ephR: SerializableBigInt }>
  ): {
    ephRPoints: SerializableBigInt[];
    signingPartyIndices: number[];
  } {
    // partyEphKeys: [{ partyId, ephR }, ...]
    const ephRPoints = [];
    const sorted = partyEphKeys.sort((a, b) =>
      a.partyId.localeCompare(b.partyId)
    );

    for (const eph of sorted) {
      ephRPoints.push(eph.ephR);
    }

    this.ephRPoints = ephRPoints;

    if (!this.signingPartyIndices) {
      throw new StateError("Signing party indices not set");
    }
    return {
      ephRPoints,
      signingPartyIndices: this.signingPartyIndices,
    };
  }

  /**
   * Collect ephemeral commitments
   * @param {Array} partyEphCommitments - Array of { partyId, commitment, blindFactor }
   * @returns {Object} - { ephCommitments, ephBlindFactors, ephRPoints }
   */
  collectEphemeralCommitments(
    partyEphCommitments: Array<{
      partyId: string;
      commitment: SerializableBigInt;
      blindFactor: SerializableBigInt;
    }>
  ): {
    ephCommitments: SerializableBigInt[];
    ephBlindFactors: SerializableBigInt[];
    ephRPoints: SerializableBigInt[];
  } {
    const ephCommitments = [];
    const ephBlindFactors = [];
    const sorted = partyEphCommitments.sort((a, b) =>
      a.partyId.localeCompare(b.partyId)
    );

    for (const commit of sorted) {
      ephCommitments.push(commit.commitment);
      ephBlindFactors.push(commit.blindFactor);
    }

    if (!this.ephRPoints) {
      throw new StateError("Ephemeral R points not set");
    }
    return {
      ephCommitments,
      ephBlindFactors,
      ephRPoints: this.ephRPoints,
    };
  }

  /**
   * Combined: Collect ephemeral keys and commitments together
   * Used when services use startEphemeralKeyGeneration()
   * Accepts data in any format (Array or Buffer bytes) - handles conversion automatically
   * Returns data in HTTP format (Array bytes) for easy use
   * @param {Array} partyEphData - Array of { partyId, ephR, commitment, blindFactor } (bytes can be Array or Buffer)
   * @returns {Object} - { ephRPoints, ephCommitments, ephBlindFactors, signingPartyIndices } all in HTTP format
   */
  collectEphemeralKeysAndCommitments(
    partyEphData: Array<{
      partyId: string;
      ephR: SerializableBigInt;
      commitment: SerializableBigInt;
      blindFactor: SerializableBigInt;
    }>
  ): EphemeralCommitData {
    // partyEphData: [{ partyId, ephR, commitment, blindFactor }, ...]
    const sorted = partyEphData.sort((a, b) =>
      a.partyId.localeCompare(b.partyId)
    );

    const ephRPoints = [];
    const ephCommitments = [];
    const ephBlindFactors = [];

    // Normalize to Buffer for internal storage
    for (const data of sorted) {
      ephRPoints.push(serialization.normalizeBytesToBuffer(data.ephR));
      ephCommitments.push(
        serialization.normalizeBytesToBuffer(data.commitment)
      );
      ephBlindFactors.push(
        serialization.normalizeBytesToBuffer(data.blindFactor)
      );
    }

    this.ephRPoints = ephRPoints;
    this.ephCommitments = ephCommitments;
    this.ephBlindFactors = ephBlindFactors;

    // Return HTTP format (Array bytes)
    if (!this.signingPartyIndices) {
      throw new StateError("Signing party indices not set");
    }
    return {
      ephRPoints: ephRPoints.map((r) => serialization.serializeForHttp(r)),
      ephCommitments: ephCommitments.map((c) =>
        serialization.serializeForHttp(c)
      ),
      ephBlindFactors: ephBlindFactors.map((bf) =>
        serialization.serializeForHttp(bf)
      ),
      signingPartyIndices: this.signingPartyIndices,
    };
  }

  /**
   * Collect ephemeral shares
   * Accepts shares in any format (Array or Buffer bytes) - handles conversion automatically
   * Returns data in HTTP format (Array bytes) for easy use
   * @param {Array} partyEphShares - Array of { partyId, vss, secretShares } (bytes can be Array or Buffer)
   * @returns {Object} - Ephemeral key construction data by party ID in HTTP format
   */
  collectEphemeralShares(
    partyEphShares: Array<{
      partyId: string;
      vss: VSSScheme;
      secretShares: SecretShare[];
    }>
  ): EphemeralShareData {
    const allEphVssSchemes = [];
    const allEphSecretShares = [];
    const sorted = partyEphShares.sort((a, b) =>
      a.partyId.localeCompare(b.partyId)
    );

    // Normalize secretShares to Buffer for internal storage
    for (const share of sorted) {
      allEphVssSchemes.push(share.vss);
      allEphSecretShares.push(
        share.secretShares.map((s) => serialization.normalizeBytesToBuffer(s))
      );
    }

    this.allEphVssSchemes = allEphVssSchemes;
    this.allEphSecretShares = allEphSecretShares;

    if (
      !this.signingPartyIndices ||
      !this.session ||
      !this.ephRPoints ||
      !this.allEphSecretShares
    ) {
      throw new StateError("Required state not initialized");
    }
    const shareCount = this.signingPartyIndices.length;
    const threshold = this.session.threshold;

    // Return data for each signing party in HTTP format
    const result: EphemeralShareData = {};
    for (let i = 0; i < this.signingPartyIndices.length; i++) {
      const partyIdx = this.signingPartyIndices[i];
      if (partyIdx === undefined) {
        throw new StateError(
          `Signing party index at position ${i} is undefined`
        );
      }
      const party = this.parties[partyIdx];
      if (!party) {
        throw new StateError(`Party at index ${partyIdx} is undefined`);
      }

      result[party.partyId] = {
        threshold,
        shareCount,
        ephRPoints: this.ephRPoints.map((r) =>
          serialization.serializeForHttp(r)
        ),
        allEphSecretShares: serialization.serialize2DArrayForHttp(
          this.allEphSecretShares
        ),
        allEphVssSchemes: this.allEphVssSchemes,
        partyIndex: partyIdx,
        signingParties: this.signingPartyIndices,
      };
    }

    return result;
  }

  /**
   * Collect local signatures and generate final signature
   * Accepts localSigs in any format (Array or Buffer bytes) - handles conversion automatically
   * Returns data in HTTP format (Array bytes) for easy use
   * @param {Array} partyLocalSigs - Array of { partyId, localSig } (bytes can be Array or Buffer)
   * @returns {Object} - { signature: {r, s}, signatureHex, aggregatePublicKey: {bytes: Array}, aggregatePublicKeyHex, isValid } in HTTP format
   */
  collectLocalSignatures(
    partyLocalSigs: Array<{ partyId: string; localSig: LocalSignature }>
  ): SignatureResult {
    // partyLocalSigs: [{ partyId, localSig }, ...]
    const localSigs = [];
    const sorted = partyLocalSigs.sort((a, b) =>
      a.partyId.localeCompare(b.partyId)
    );

    // Normalize to Rust format (Array bytes) for Rust bindings
    for (const sig of sorted) {
      localSigs.push({
        gammaI: serialization.normalizeBytesForRust(sig.localSig.gammaI),
        k: serialization.normalizeBytesForRust(sig.localSig.k),
      });
    }

    if (
      !this.signingPartyIndices ||
      !this.signingSession ||
      !this.allVssSchemes ||
      !this.allEphVssSchemes ||
      !this.ephSharedKeys ||
      !this.aggregatePublicKey
    ) {
      throw new StateError("Required state not initialized");
    }

    // Ensure aggregateR has Array bytes before coordinator service accesses it
    if (this.ephSharedKeys.length > 0) {
      const firstKey = this.ephSharedKeys[0];
      if (!firstKey) {
        throw new StateError("First ephemeral shared key is undefined");
      }
      const aggregateR = firstKey.r || firstKey.R;
      if (aggregateR && aggregateR.bytes) {
        if (!Array.isArray(aggregateR.bytes)) {
          aggregateR.bytes = Array.from(aggregateR.bytes, (b) =>
            typeof b === "number" ? b : Number(b)
          );
        } else {
          aggregateR.bytes = aggregateR.bytes.map((b) =>
            typeof b === "number" ? b : Number(b)
          );
        }
      }
    }

    // Verify local signatures
    const vssSum = MPCClient.verifyLocalSignatures(
      localSigs,
      this.signingPartyIndices,
      this.allVssSchemes,
      this.allEphVssSchemes
    );

    // Generate final signature
    if (this.ephSharedKeys.length === 0) {
      throw new StateError("No ephemeral shared keys available");
    }
    const firstEphKey = this.ephSharedKeys[0];
    if (!firstEphKey) {
      throw new StateError("First ephemeral shared key is undefined");
    }
    const aggregateR = firstEphKey.r || firstEphKey.R;
    if (!aggregateR) {
      throw new StateError("Aggregate R not found");
    }
    const signature = MPCClient.aggregateSignature(
      vssSum,
      localSigs,
      this.signingPartyIndices,
      aggregateR
    );

    // Verify signature
    // Convert message to Array format for verification (Rust binding expects Array)
    const messageArray = serialization.messageToArray(
      this.signingSession.message
    );

    // Convert aggregatePublicKey to Array format for Rust (Rust binding expects Array bytes)
    const aggregatePublicKeyArray = {
      bytes: Array.isArray(this.aggregatePublicKey.bytes)
        ? this.aggregatePublicKey.bytes
        : Array.from(this.aggregatePublicKey.bytes),
    };

    const isValid = MPCClient.verifySignature(
      signature,
      messageArray,
      aggregatePublicKeyArray
    );

    // Return HTTP format (Array bytes)
    const sigR = signature.r || signature.R;
    const sigS = signature.s || signature.S;
    const signatureHex =
      Buffer.from(sigR.bytes).toString("hex") +
      Buffer.from(sigS.bytes).toString("hex");

    return {
      signature: {
        r: serialization.serializeForHttp(sigR),
        s: serialization.serializeForHttp(sigS),
      },
      signatureHex,
      aggregatePublicKey: serialization.serializeForHttp(
        this.aggregatePublicKey
      ),
      aggregatePublicKeyHex: Buffer.from(
        this.aggregatePublicKey.bytes
      ).toString("hex"),
      isValid,
    };
  }

  /**
   * Get message in Array format for HTTP calls
   * Helper method to convert stored message (Buffer) to Array for JSON serialization
   * @returns {Array<number>} - Message as Array
   */
  getMessageForHttp(): number[] {
    if (!this.signingSession || !this.signingSession.message) {
      throw new SessionError("No signing session or message available");
    }
    return serialization.messageToArray(this.signingSession.message);
  }

  /**
   * Get commit data for share distribution in HTTP format
   * Helper method to get data needed for distribute endpoint
   * @returns {Object} - Commit data in HTTP format
   */
  getCommitDataForSharesHttp(): CommitData {
    if (!this.session) {
      throw new SessionError("Session not initialized");
    }
    return {
      threshold: this.session.threshold,
      shareCount: this.session.totalParties,
      blindFactors: this.blindFactors.map((bf) =>
        serialization.serializeForHttp(bf)
      ),
      publicKeys: this.parties.map((p) =>
        serialization.serializeForHttp(p.publicKey)
      ),
      commitments: this.commitments.map((c) =>
        serialization.serializeForHttp(c)
      ),
      parties: this.parties.map((p) => p.protocolIndex || 0),
    };
  }

  /**
   * Get key construction data in HTTP format
   * Helper method to get data needed for construct endpoint (after shares collected)
   * @returns {Object} - Key construction data by party ID in HTTP format
   */
  getKeyConstructionDataHttp(): ShareData {
    if (
      !this.session ||
      !this.allSecretShares ||
      this.allSecretShares.length === 0
    ) {
      throw new StateError(
        "Shares not collected. Make sure collect-shares was called first."
      );
    }

    const shareCount = this.parties.length;
    const threshold = this.session.threshold;
    const result: ShareData = {};

    for (let i = 0; i < shareCount; i++) {
      const party = this.parties[i];
      if (!party) {
        throw new PartyError(`Party at index ${i} is undefined`);
      }
      if (party.protocolIndex === undefined) {
        throw new PartyError(`Party ${party.partyId} has no protocolIndex`);
      }
      result[party.partyId] = {
        threshold,
        shareCount,
        publicKeys: this.parties.map((p) =>
          serialization.serializeForHttp(p.publicKey)
        ),
        allSecretShares: serialization.serialize2DArrayForHttp(
          this.allSecretShares
        ),
        allVssSchemes: this.allVssSchemes,
        partyIndex: party.protocolIndex,
      };
    }

    return result;
  }

  /**
   * Get ephemeral commit data for share distribution in HTTP format
   * @returns {Object} - Ephemeral commit data in HTTP format
   */
  getEphCommitDataForSharesHttp(): EphemeralCommitData {
    if (
      !this.ephRPoints ||
      this.ephRPoints.length === 0 ||
      !this.signingPartyIndices
    ) {
      throw new StateError("Ephemeral keys not collected");
    }
    return {
      ephRPoints: this.ephRPoints.map((r) => serialization.serializeForHttp(r)),
      ephCommitments: (this.ephCommitments || []).map((c) =>
        serialization.serializeForHttp(c)
      ),
      ephBlindFactors: (this.ephBlindFactors || []).map((bf) =>
        serialization.serializeForHttp(bf)
      ),
      signingPartyIndices: this.signingPartyIndices,
    };
  }

  /**
   * Get ephemeral key construction data in HTTP format
   * Helper method to get data needed for construct-ephemeral endpoint (after ephemeral shares collected)
   * @returns {Object} - Ephemeral key construction data by party ID in HTTP format
   */
  getEphKeyConstructionDataHttp(): EphemeralShareData {
    if (!this.allEphSecretShares || this.allEphSecretShares.length === 0) {
      throw new StateError(
        "Ephemeral shares not collected. Make sure collect-ephemeral-shares was called first."
      );
    }
    if (!this.ephRPoints || this.ephRPoints.length === 0) {
      throw new StateError(
        "Ephemeral R points not available. Make sure collect-ephemeral-keys was called first."
      );
    }
    if (!this.signingPartyIndices || !this.session || !this.allEphVssSchemes) {
      throw new StateError("Required state not initialized");
    }

    const shareCount = this.signingPartyIndices.length;
    const threshold = this.session.threshold;
    const result: EphemeralShareData = {};

    for (let i = 0; i < this.signingPartyIndices.length; i++) {
      const partyIdx = this.signingPartyIndices[i];
      if (partyIdx === undefined) {
        throw new StateError(
          `Signing party index at position ${i} is undefined`
        );
      }
      const party = this.parties[partyIdx];
      if (!party) {
        throw new StateError(`Party at index ${partyIdx} is undefined`);
      }

      result[party.partyId] = {
        threshold,
        shareCount,
        ephRPoints: this.ephRPoints.map((r) =>
          serialization.serializeForHttp(r)
        ),
        allEphSecretShares: serialization.serialize2DArrayForHttp(
          this.allEphSecretShares
        ),
        allEphVssSchemes: this.allEphVssSchemes,
        partyIndex: partyIdx,
        signingParties: this.signingPartyIndices,
      };
    }

    return result;
  }

  /**
   * Helper: Get party index from partyId
   * @private
   * @param {string} partyId - Party identifier
   * @returns {number} - Party index
   */
  private _getPartyIndexFromId(partyId: string): number {
    const crypto = require("crypto");
    const hash = crypto.createHash("sha256").update(partyId).digest();
    return hash.readUInt16BE(0);
  }
}
