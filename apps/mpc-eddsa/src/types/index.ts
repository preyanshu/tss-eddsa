/**
 * Type definitions for Multi-Party EdDSA
 */

export interface SerializableBigInt {
  bytes: number[] | Buffer;
}

export interface PublicKey {
  bytes: number[] | Buffer;
}

export interface Commitment {
  bytes: number[] | Buffer;
}

export interface BlindFactor {
  bytes: number[] | Buffer;
}

export interface SecretShare {
  bytes: number[] | Buffer;
}

export interface VSSScheme {
  share_count?: number;
  shareCount?: number;
  commitments?: SerializableBigInt[];
  [key: string]: any;
}

export interface SharedKey {
  y: SerializableBigInt;
  xI: SerializableBigInt;
  x_i?: SerializableBigInt;
  prefix?: SerializableBigInt;
}

export interface EphemeralSharedKey {
  r: SerializableBigInt;
  R?: SerializableBigInt;
  rI: SerializableBigInt;
  r_i?: SerializableBigInt;
}

export interface LocalSignature {
  gammaI: SerializableBigInt;
  gamma_i?: SerializableBigInt;
  k: SerializableBigInt;
}

export interface Signature {
  r: SerializableBigInt;
  R?: SerializableBigInt;
  s: SerializableBigInt;
  S?: SerializableBigInt;
}

export interface Party {
  partyId: string;
  publicKey: SerializableBigInt;
  partyIndex: number;
  protocolIndex?: number;
}

export interface KeyGenSession {
  threshold: number;
  totalParties: number;
  phase: 'keygen';
}

export interface SigningSession {
  message: Buffer;
  signingParties: string[];
  phase: 'signing';
}

export interface KeyGenResult {
  keyId: string;
  publicKey: PublicKey;
}

export interface CommitmentResult {
  commitment: Commitment;
  blindFactor: BlindFactor;
}

export interface ShareDistributionResult {
  vss: VSSScheme;
  secretShares: SecretShare[];
}

export interface KeypairConstructionResult {
  sharedKey: SharedKey;
}

export interface EphemeralKeyResult {
  ephKeyId: string;
  ephR: SerializableBigInt;
}

export interface EphemeralCommitmentResult {
  commitment: Commitment;
  blindFactor: BlindFactor;
}

export interface AggregateKeyResult {
  aggregatePublicKey: PublicKey;
  sharedKeys: SharedKey[];
}

export interface SignatureResult {
  signature: Signature;
  signatureHex: string;
  aggregatePublicKey: PublicKey;
  aggregatePublicKeyHex: string;
  isValid: boolean;
}

export interface RegistrationResult {
  partyId: string;
  publicKey: SerializableBigInt;
  publicKeyHex: string;
}

export interface PartyRegistrationResponse {
  partyIndex: number;
  totalParties: number;
}

export interface CommitData {
  threshold: number;
  shareCount: number;
  blindFactors: SerializableBigInt[];
  publicKeys: SerializableBigInt[];
  commitments: SerializableBigInt[];
  parties: number[];
}

export interface ShareData {
  [partyId: string]: {
    threshold: number;
    shareCount: number;
    publicKeys: SerializableBigInt[];
    allSecretShares: SecretShare[][];
    allVssSchemes: VSSScheme[];
    partyIndex: number;
  };
}

export interface EphemeralCommitData {
  ephRPoints: SerializableBigInt[];
  ephCommitments: SerializableBigInt[];
  ephBlindFactors: SerializableBigInt[];
  signingPartyIndices: number[];
}

export interface EphemeralShareData {
  [partyId: string]: {
    threshold: number;
    shareCount: number;
    ephRPoints: SerializableBigInt[];
    allEphSecretShares: SecretShare[][];
    allEphVssSchemes: VSSScheme[];
    partyIndex: number;
    signingParties: number[];
  };
}

