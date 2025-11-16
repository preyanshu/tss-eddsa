import { SerializableBigInt, VSSScheme, SecretShare, EphemeralSharedKey } from '../types';

/**
 * Serialization utilities for converting between different byte formats
 * (Buffer, Array, etc.) used by Rust bindings and HTTP APIs
 */

/**
 * Normalize bytes object to Rust format (Array)
 * Accepts {bytes: Array|Buffer|Array-like} and returns {bytes: Array}
 * Rust bindings expect Array bytes, not Buffer
 */
export function normalizeBytesForRust(obj: SerializableBigInt | any): SerializableBigInt {
  if (!obj || obj.bytes === undefined) return obj;
  const bytes = Array.isArray(obj.bytes) 
    ? obj.bytes 
    : (Buffer.isBuffer(obj.bytes) ? Array.from(obj.bytes) : Array.from(obj.bytes));
  return { bytes };
}

/**
 * Normalize bytes object to Buffer format
 * Accepts {bytes: Array|Buffer|Array-like} and returns {bytes: Buffer}
 * Used for internal storage in CoordinatorService
 */
export function normalizeBytesToBuffer(obj: SerializableBigInt | any): SerializableBigInt {
  if (!obj || obj.bytes === undefined) return obj;
  const bytes = Buffer.isBuffer(obj.bytes) 
    ? obj.bytes 
    : (Array.isArray(obj.bytes) ? Buffer.from(obj.bytes) : Buffer.from(obj.bytes));
  return { bytes };
}

/**
 * Serialize object for HTTP (convert bytes to Array)
 * HTTP APIs use Array format for JSON serialization
 */
export function serializeForHttp(obj: SerializableBigInt | any): SerializableBigInt {
  if (!obj || obj.bytes === undefined) return obj;
  return { bytes: Array.isArray(obj.bytes) ? obj.bytes : Array.from(obj.bytes) };
}

/**
 * Normalize message to Buffer format
 * Accepts Buffer|Array|String and returns Buffer
 */
export function normalizeMessage(message: Buffer | number[] | string): Buffer {
  if (Buffer.isBuffer(message)) return message;
  if (Array.isArray(message)) return Buffer.from(message);
  return Buffer.from(message || 'default');
}

/**
 * Convert message to Array format for HTTP calls
 * Accepts Buffer|Array|String and returns Array
 */
export function messageToArray(message: Buffer | number[] | string): number[] {
  if (Array.isArray(message)) return message;
  if (Buffer.isBuffer(message)) return Array.from(message);
  return Array.from(Buffer.from(message || 'default'));
}

/**
 * Serialize VSS object for HTTP
 * Recursively converts all bytes properties to Array format
 */
export function serializeVss(vss: VSSScheme): VSSScheme {
  if (!vss) return vss;
  const serialized = { ...vss };
  
  // Convert SerializableBigInt objects in commitments array
  if (serialized.commitments && Array.isArray(serialized.commitments)) {
    serialized.commitments = serialized.commitments.map(c => serializeForHttp(c));
  }
  
  // Handle any other SerializableBigInt fields
  for (const key in serialized) {
    if (serialized[key] && typeof serialized[key] === 'object' && serialized[key].bytes) {
      serialized[key] = serializeForHttp(serialized[key]);
    }
  }
  
  return serialized;
}

/**
 * Normalize 2D array of bytes objects to Rust format
 */
export function normalize2DArrayForRust(arr: SecretShare[][]): SecretShare[][] {
  return arr.map(row => 
    row.map(item => normalizeBytesForRust(item))
  );
}

/**
 * Serialize 2D array for HTTP
 */
export function serialize2DArrayForHttp(arr: SecretShare[][]): SerializableBigInt[][] {
  return arr.map(row => 
    row.map(item => serializeForHttp(item))
  );
}

/**
 * Normalize ephemeral shared key (handle r/R property mismatch)
 * Rust uses 'r', HTTP uses 'R'
 */
export function normalizeEphSharedKey(ephSharedKey: EphemeralSharedKey): EphemeralSharedKey {
  return {
    r: normalizeBytesForRust(ephSharedKey.r || ephSharedKey.R),
    rI: normalizeBytesForRust(ephSharedKey.rI)
  };
}

/**
 * Serialize ephemeral shared key for HTTP (always use R)
 */
export function serializeEphSharedKey(ephSharedKey: EphemeralSharedKey): { R: SerializableBigInt; rI: SerializableBigInt } {
  return {
    R: serializeForHttp(ephSharedKey.r || ephSharedKey.R),
    rI: serializeForHttp(ephSharedKey.rI)
  };
}

