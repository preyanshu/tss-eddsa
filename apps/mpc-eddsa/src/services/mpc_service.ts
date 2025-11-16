import { MPCClient } from '../client/mpc_client';
import {
  SerializableBigInt,
  Commitment,
  BlindFactor,
  SecretShare,
  VSSScheme,
  SharedKey,
  EphemeralSharedKey,
  RegistrationResult,
  CommitmentResult,
  ShareDistributionResult,
  KeypairConstructionResult,
  EphemeralKeyResult,
  EphemeralCommitmentResult
} from '../types';
import * as serialization from '../utils/serialization';
import { ServiceError } from '../errors';

/**
 * MPC Service - Runs on each party's server
 * 
 * This class represents what runs on a single MPC service.
 * Each party has their own instance of this service.
 * 
 * @example
 * const MPCService = require('multi-party-eddsa/MPCService');
 * const service = new MPCService('party-0');
 * service.initialize();
 */
export class MPCService {
    private partyId: string;
    private keyId: string | null = null;
    private sharedKey: SharedKey | null = null;

    constructor(partyId: string) {
        this.partyId = partyId;
    }

    /**
     * Step 1: Initialize - Create party's key
     * Called once when service starts
     * Returns data in HTTP format (Array bytes) for easy use
     * @returns {Object} - { partyId, publicKey: {bytes: Array}, publicKeyHex }
     */
    initialize(): RegistrationResult {
        // Create party's key
        const { keyId, publicKey } = MPCClient.createPubKey(this._getPartyIndex());
        this.keyId = keyId;
        
        // Return HTTP format (Array bytes)
        return {
            partyId: this.partyId,
            publicKey: serialization.serializeForHttp(publicKey),
            publicKeyHex: Buffer.from(publicKey.bytes).toString('hex')
        };
    }

    /**
     * Combined: Initialize and return registration data
     * Convenience method that combines initialize
     * @returns {Object} - { partyId, publicKey, publicKeyHex }
     */
    register(): RegistrationResult {
        return this.initialize();
    }

    /**
     * Step 2: Generate commitment for key generation
     * Coordinator calls this
     * Returns data in HTTP format (Array bytes) for easy use
     * @returns {Object} - { commitment: {bytes: Array}, blindFactor: {bytes: Array} }
     */
    generateCommitment(): CommitmentResult {
        if (!this.keyId) {
            throw new ServiceError('Service not initialized');
        }
        const commit = MPCClient.generateCommitment(this.keyId);
        // Return HTTP format (Array bytes)
        return {
            commitment: serialization.serializeForHttp(commit.commitment),
            blindFactor: serialization.serializeForHttp(commit.blindFactor)
        };
    }

    /**
     * Step 3: Distribute secret shares
     * Coordinator calls this with all parties' data
     * Accepts data in any format (Array or Buffer bytes) - handles conversion automatically
     * Returns data in HTTP format (Array bytes) for easy use
     * @param {number} threshold - Threshold value
     * @param {number} shareCount - Total number of parties
     * @param {Array} blindFactors - Array of blind factors from all parties (bytes can be Array or Buffer)
     * @param {Array} publicKeys - Array of public keys from all parties (bytes can be Array or Buffer)
     * @param {Array} commitments - Array of commitments from all parties (bytes can be Array or Buffer)
     * @param {number} partyIndex - Zero-indexed party number
     * @returns {Object} - { vss, secretShares: [{bytes: Array}, ...] } in HTTP format
     */
    distributeShares(
        threshold: number,
        shareCount: number,
        blindFactors: SerializableBigInt[],
        publicKeys: SerializableBigInt[],
        commitments: SerializableBigInt[],
        partyIndex: number
    ): ShareDistributionResult {
        if (!this.keyId) {
            throw new ServiceError('Service not initialized');
        }
        
        // Normalize to Rust format (Array bytes) for Rust bindings
        const blindFactorsRust = blindFactors.map(bf => serialization.normalizeBytesForRust(bf));
        const publicKeysRust = publicKeys.map(pk => serialization.normalizeBytesForRust(pk));
        const commitmentsRust = commitments.map(c => serialization.normalizeBytesForRust(c));
        
        const result = MPCClient.distributeShares(
            this.keyId,
            threshold,
            shareCount,
            blindFactorsRust,
            publicKeysRust,
            commitmentsRust,
            partyIndex
        );
        
        // Return HTTP format (Array bytes)
        return {
            vss: serialization.serializeVss(result.vss),
            secretShares: result.secretShares.map((s: SecretShare) => serialization.serializeForHttp(s))
        };
    }

    /**
     * Step 4: Construct shared keypair
     * Coordinator calls this with shares received from all parties
     * Accepts data in any format (Array or Buffer bytes) - handles conversion automatically
     * Returns data in HTTP format (Array bytes) for easy use
     * @param {number} threshold - Threshold value
     * @param {number} shareCount - Total number of parties
     * @param {Array} publicKeys - Array of public keys from all parties (bytes can be Array or Buffer)
     * @param {Array<Array>} allSecretShares - 2D array of secret shares from all parties (bytes can be Array or Buffer)
     * @param {Array} allVssSchemes - Array of VSS schemes from all parties
     * @param {number} partyIndex - Zero-indexed party number
     * @returns {Object} - { sharedKey: { y: {bytes: Array}, xI: {bytes: Array}, prefix?: {bytes: Array} } } in HTTP format
     */
    constructKeypair(
        threshold: number,
        shareCount: number,
        publicKeys: SerializableBigInt[],
        allSecretShares: SecretShare[][],
        allVssSchemes: VSSScheme[],
        partyIndex: number
    ): KeypairConstructionResult {
        if (!this.keyId) {
            throw new ServiceError('Service not initialized');
        }
        
        // Normalize to Rust format (Array bytes) for Rust bindings
        const publicKeysRust = publicKeys.map(pk => serialization.normalizeBytesForRust(pk));
        const allSecretSharesRust = serialization.normalize2DArrayForRust(allSecretShares);
        
        // MPCClient.constructKeypair expects allSecretShares (full 2D array)
        // and extracts this party's shares internally
        this.sharedKey = MPCClient.constructKeypair(
            this.keyId,
            threshold,
            shareCount,
            publicKeysRust,
            allSecretSharesRust,  // Full 2D array
            allVssSchemes,
            partyIndex
        );
        
        // Return HTTP format (Array bytes)
        if (!this.sharedKey) {
            throw new ServiceError('Shared key not constructed');
        }
        return {
            sharedKey: {
                y: serialization.serializeForHttp(this.sharedKey.y),
                xI: serialization.serializeForHttp(this.sharedKey.xI),
                prefix: this.sharedKey.prefix ? serialization.serializeForHttp(this.sharedKey.prefix) : undefined
            }
        };
    }

    /**
     * Step 5: Create ephemeral key for signing
     * Coordinator calls this when signing starts
     * @param {Buffer|Array|string} message - Message to sign
     * @param {number} partyIndex - Zero-indexed party number
     * @returns {Object} - { ephKeyId, ephR }
     */
    createEphemeralKey(message: Buffer | number[] | string, partyIndex: number): EphemeralKeyResult {
        if (!this.keyId) {
            throw new ServiceError('Service not initialized');
        }
        
        // Normalize message to Buffer | number[] for Rust
        const messageNormalized = serialization.normalizeMessage(message);
        const messageArray = Buffer.isBuffer(messageNormalized) ? Array.from(messageNormalized) : messageNormalized;
        
        const ephData = MPCClient.createEphemeralKey(
            this.keyId,
            messageArray,
            partyIndex
        );
        
        return {
            ephKeyId: ephData.ephKeyId,
            ephR: ephData.ephR
        };
    }

    /**
     * Combined: Create ephemeral key and generate commitment
     * Accepts message in any format (Buffer, Array, or string) - handles conversion automatically
     * Returns data in HTTP format (Array bytes) for easy use
     * @param {Buffer|Array|string} message - Message to sign (any format)
     * @param {number} partyIndex - Zero-indexed party number
     * @returns {Object} - { ephKeyId, ephR: {bytes: Array}, commitment: {bytes: Array}, blindFactor: {bytes: Array} } in HTTP format
     */
    startEphemeralKeyGeneration(message: Buffer | number[] | string, partyIndex: number): {
        ephKeyId: string;
        ephR: SerializableBigInt;
        commitment: Commitment;
        blindFactor: BlindFactor;
    } {
        if (!this.keyId) {
            throw new ServiceError('Service not initialized');
        }
        
        // Normalize message to Buffer for Rust bindings, then convert to number[] for Rust
        const messageBuffer = serialization.normalizeMessage(message);
        const messageArray = Buffer.isBuffer(messageBuffer) ? Array.from(messageBuffer) : messageBuffer;
        
        // Create ephemeral key
        const ephData = MPCClient.createEphemeralKey(this.keyId, messageArray, partyIndex);
        
        // Generate commitment
        const commit = MPCClient.generateEphemeralCommitment(ephData.ephKeyId);
        
        // Return HTTP format (Array bytes)
        return {
            ephKeyId: ephData.ephKeyId,
            ephR: serialization.serializeForHttp(ephData.ephR),
            commitment: serialization.serializeForHttp(commit.commitment),
            blindFactor: serialization.serializeForHttp(commit.blindFactor)
        };
    }

    /**
     * Step 6: Generate ephemeral commitment
     * @param {string} ephKeyId - Ephemeral key ID
     * @returns {Object} - { commitment, blindFactor }
     */
    generateEphemeralCommitment(ephKeyId: string): EphemeralCommitmentResult {
        const commit = MPCClient.generateEphemeralCommitment(ephKeyId);
        return {
            commitment: commit.commitment,
            blindFactor: commit.blindFactor
        };
    }

    /**
     * Step 7: Distribute ephemeral shares
     * Accepts data in any format (Array or Buffer bytes) - handles conversion automatically
     * Returns data in HTTP format (Array bytes) for easy use
     * @param {string} ephKeyId - Ephemeral key ID
     * @param {number} threshold - Threshold value
     * @param {number} shareCount - Total number of signing parties
     * @param {Array} ephBlindFactors - Array of ephemeral blind factors (bytes can be Array or Buffer)
     * @param {Array} ephRPoints - Array of ephemeral R points (bytes can be Array or Buffer)
     * @param {Array} ephCommitments - Array of ephemeral commitments (bytes can be Array or Buffer)
     * @param {Array<number>} signingParties - Array of party indices that are signing
     * @returns {Object} - { vss, secretShares: [{bytes: Array}, ...] } in HTTP format
     */
    distributeEphemeralShares(
        ephKeyId: string,
        threshold: number,
        shareCount: number,
        ephBlindFactors: SerializableBigInt[],
        ephRPoints: SerializableBigInt[],
        ephCommitments: SerializableBigInt[],
        signingParties: number[]
    ): ShareDistributionResult {
        // Normalize to Rust format (Array bytes) for Rust bindings
        const ephBlindFactorsRust = ephBlindFactors.map(bf => serialization.normalizeBytesForRust(bf));
        const ephRPointsRust = ephRPoints.map(r => serialization.normalizeBytesForRust(r));
        const ephCommitmentsRust = ephCommitments.map(c => serialization.normalizeBytesForRust(c));
        
        const result = MPCClient.distributeEphemeralShares(
            ephKeyId,
            threshold,
            shareCount,
            ephBlindFactorsRust,
            ephRPointsRust,
            ephCommitmentsRust,
            signingParties
        );
        
        // Return HTTP format (Array bytes)
        return {
            vss: serialization.serializeVss(result.vss),
            secretShares: result.secretShares.map((s: SecretShare) => serialization.serializeForHttp(s))
        };
    }

    /**
     * Step 8: Construct ephemeral shared keypair
     * Accepts data in any format (Array or Buffer bytes) - handles conversion automatically
     * Returns data in HTTP format (Array bytes) for easy use
     * @param {string} ephKeyId - Ephemeral key ID
     * @param {number} threshold - Threshold value
     * @param {number} shareCount - Total number of signing parties
     * @param {Array} ephRPoints - Array of ephemeral R points (bytes can be Array or Buffer)
     * @param {Array<Array>} allEphSecretShares - 2D array of ephemeral secret shares (bytes can be Array or Buffer)
     * @param {Array} allEphVssSchemes - Array of ephemeral VSS schemes
     * @param {number} partyIndex - Zero-indexed party number
     * @param {Array<number>} signingParties - Array of party indices that are signing
     * @returns {Object} - { ephSharedKey: { R: {bytes: Array}, rI: {bytes: Array} } } in HTTP format
     */
    constructEphemeralKeypair(
        ephKeyId: string,
        threshold: number,
        shareCount: number,
        ephRPoints: SerializableBigInt[],
        allEphSecretShares: SecretShare[][],
        allEphVssSchemes: VSSScheme[],
        partyIndex: number,
        signingParties: number[]
    ): { ephSharedKey: { R: SerializableBigInt; rI: SerializableBigInt } } {
        // Normalize to Rust format (Array bytes) for Rust bindings
        const ephRPointsRust = ephRPoints.map(r => serialization.normalizeBytesForRust(r));
        const allEphSecretSharesRust = serialization.normalize2DArrayForRust(allEphSecretShares);
        
        // MPCClient.constructEphemeralKeypair expects allEphSecretShares (full 2D array)
        // and extracts this party's shares internally
        const ephSharedKey = MPCClient.constructEphemeralKeypair(
            ephKeyId,
            threshold,
            shareCount,
            ephRPointsRust,
            allEphSecretSharesRust,  // Full 2D array
            allEphVssSchemes,
            partyIndex,
            signingParties
        );
        
        // Return HTTP format (Array bytes, always use R for HTTP)
        return {
            ephSharedKey: serialization.serializeEphSharedKey(ephSharedKey)
        };
    }

    /**
     * Step 9: Compute local signature
     * Accepts message and ephSharedKey in any format - handles conversion automatically
     * Returns data in HTTP format (Array bytes) for easy use
     * @param {Buffer|Array|string} message - Message to sign (any format)
     * @param {Object} ephSharedKey - Ephemeral shared keypair (bytes can be Array or Buffer, can have r or R property)
     * @returns {Object} - { localSig: { gammaI: {bytes: Array}, k: {bytes: Array} } } in HTTP format
     */
    computeLocalSignature(
        message: Buffer | number[] | string,
        ephSharedKey: EphemeralSharedKey
    ): { localSig: { gammaI: SerializableBigInt; k: SerializableBigInt } } {
        if (!this.sharedKey) {
            throw new ServiceError('Shared key not constructed');
        }
        
        // Normalize message to Buffer for Rust bindings
        const messageBuffer = serialization.normalizeMessage(message);
        // Normalize ephSharedKey to Rust format (handle r/R property mismatch)
        const ephSharedKeyRust = serialization.normalizeEphSharedKey(ephSharedKey);
        
        const localSig = MPCClient.computeLocalSignature(
            messageBuffer,
            ephSharedKeyRust,
            this.sharedKey
        );
        
        // Return HTTP format (Array bytes)
        return {
            localSig: {
                gammaI: serialization.serializeForHttp(localSig.gammaI),
                k: serialization.serializeForHttp(localSig.k)
            }
        };
    }


    /**
     * Helper: Get party index from partyId (deterministic)
     * @private
     * @returns {number} - Party index
     */
    private _getPartyIndex(): number {
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(this.partyId).digest();
        return hash.readUInt16BE(0);
    }
}


