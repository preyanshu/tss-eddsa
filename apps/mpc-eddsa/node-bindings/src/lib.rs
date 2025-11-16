#![allow(non_snake_case)]

use multi_party_eddsa::protocols::thresholdsig::{
    self, EphemeralKey, EphemeralSharedKeys, Keys, LocalSig, Parameters, SharedKeys,
};
use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use curv::BigInt;
use curv::arithmetic::Converter;

// Serializable wrapper types for NAPI
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SerializablePoint {
    pub bytes: Vec<u8>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SerializableScalar {
    pub bytes: Vec<u8>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SerializableBigInt {
    pub bytes: Vec<u8>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SerializableSharedKeys {
    pub y: SerializablePoint,
    pub x_i: SerializableScalar,
    pub prefix: SerializableScalar,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SerializableEphemeralSharedKeys {
    pub R: SerializablePoint,
    pub r_i: SerializableScalar,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SerializableSignature {
    pub R: SerializablePoint,
    pub s: SerializableScalar,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SerializableKeyGenBroadcastMessage1 {
    pub com: SerializableBigInt,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SerializableVerifiableSS {
    pub threshold: u16,
    #[serde(rename = "share_count")]
    #[napi(js_name = "shareCount")]
    pub share_count: u16,
    pub commitments: Vec<SerializablePoint>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SerializableSecretShares {
    pub shares: Vec<SerializableScalar>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SerializableLocalSig {
    #[serde(rename = "gamma_i")]
    #[napi(js_name = "gammaI")]
    pub gamma_i: SerializableScalar,
    pub k: SerializableScalar,
}

// Helper functions to convert between types
fn point_to_serializable(p: &curv::elliptic::curves::Point<curv::elliptic::curves::Ed25519>) -> SerializablePoint {
    SerializablePoint {
        bytes: p.to_bytes(true).to_vec(),
    }
}

fn scalar_to_serializable(s: &curv::elliptic::curves::Scalar<curv::elliptic::curves::Ed25519>) -> SerializableScalar {
    SerializableScalar {
        bytes: s.to_bytes().to_vec(),
    }
}

fn bigint_to_serializable(b: &BigInt) -> SerializableBigInt {
    SerializableBigInt {
        bytes: b.to_bytes(),
    }
}

fn serializable_to_point(sp: &SerializablePoint) -> napi::Result<curv::elliptic::curves::Point<curv::elliptic::curves::Ed25519>> {
    let bytes: [u8; 32] = sp.bytes.as_slice().try_into()
        .map_err(|_| napi::Error::new(Status::InvalidArg, "Invalid point bytes length"))?;
    curv::elliptic::curves::Point::from_bytes(&bytes)
        .map_err(|_| napi::Error::new(Status::InvalidArg, "Invalid point"))
}

fn serializable_to_scalar(ss: &SerializableScalar) -> napi::Result<curv::elliptic::curves::Scalar<curv::elliptic::curves::Ed25519>> {
    let bytes: [u8; 32] = ss.bytes.as_slice().try_into()
        .map_err(|_| napi::Error::new(Status::InvalidArg, "Invalid scalar bytes length"))?;
    curv::elliptic::curves::Scalar::from_bytes(&bytes)
        .map_err(|_| napi::Error::new(Status::InvalidArg, "Invalid scalar"))
}

fn serializable_to_bigint(sb: &SerializableBigInt) -> BigInt {
    BigInt::from_bytes(&sb.bytes)
}

// NAPI Module
#[napi]
pub mod threshold_sig {
    use super::*;
    use curv::cryptographic_primitives::secret_sharing::feldman_vss::VerifiableSS;
    use curv::elliptic::curves::{Ed25519, Point, Scalar};
    use curv::BigInt;
    use std::sync::{Mutex, OnceLock};

    // Store Keys instances (in a real implementation, you'd want better state management)
    fn keys_store() -> &'static Mutex<HashMap<String, Keys>> {
        static STORE: OnceLock<Mutex<HashMap<String, Keys>>> = OnceLock::new();
        STORE.get_or_init(|| Mutex::new(HashMap::new()))
    }
    
    fn ephemeral_keys_store() -> &'static Mutex<HashMap<String, EphemeralKey>> {
        static STORE: OnceLock<Mutex<HashMap<String, EphemeralKey>>> = OnceLock::new();
        STORE.get_or_init(|| Mutex::new(HashMap::new()))
    }

    #[napi]
    /// Create keys for a party (Phase 1)
    pub fn phase1_create(party_index: u16) -> Result<String> {
        let keys = Keys::phase1_create(party_index);
        let key_id = format!("keys_{}", party_index);
        keys_store().lock().unwrap().insert(key_id.clone(), keys);
        Ok(key_id)
    }

    #[napi]
    /// Create keys from a private key (Phase 1)
    pub fn phase1_create_from_private_key(party_index: u16, secret: Vec<u8>) -> Result<String> {
        let secret_array: [u8; 32] = secret.as_slice().try_into()
            .map_err(|_| napi::Error::new(Status::InvalidArg, "Secret must be 32 bytes"))?;
        let keys = Keys::phase1_create_from_private_key(party_index, secret_array);
        let key_id = format!("keys_{}", party_index);
        keys_store().lock().unwrap().insert(key_id.clone(), keys);
        Ok(key_id)
    }

    #[napi]
    /// Get public key for a keys instance
    pub fn get_public_key(key_id: String) -> Result<SerializablePoint> {
        let keys = keys_store().lock().unwrap();
        let key = keys.get(&key_id)
            .ok_or_else(|| napi::Error::new(Status::InvalidArg, "Key not found"))?;
        Ok(point_to_serializable(&key.keypair.public_key))
    }

    #[napi]
    /// Phase 1 broadcast - returns commitment and blind factor
    pub fn phase1_broadcast(key_id: String) -> Result<serde_json::Value> {
        let mut keys_store = keys_store().lock().unwrap();
        let key = keys_store.get_mut(&key_id)
            .ok_or_else(|| napi::Error::new(Status::InvalidArg, "Key not found"))?;
        
        let (bcm1, blind_factor) = key.phase1_broadcast();
        
        let result = serde_json::json!({
            "commitment": bigint_to_serializable(&bcm1.com),
            "blind_factor": bigint_to_serializable(&blind_factor)
        });
        Ok(result)
    }

    #[napi]
    /// Phase 1 verify commitments and Phase 2 distribute shares
    pub fn phase1_verify_com_phase2_distribute(
        key_id: String,
        threshold: u16,
        share_count: u16,
        blind_factors: Vec<SerializableBigInt>,
        public_keys: Vec<SerializablePoint>,
        commitments: Vec<SerializableBigInt>,
        parties: Vec<u16>,
    ) -> Result<serde_json::Value> {
        let mut keys_store = keys_store().lock().unwrap();
        let key = keys_store.get_mut(&key_id)
            .ok_or_else(|| napi::Error::new(Status::InvalidArg, "Key not found"))?;

        let params = Parameters { threshold, share_count };
        
        let blind_vec: Vec<BigInt> = blind_factors.iter().map(serializable_to_bigint).collect();
        let y_vec: Vec<Point<Ed25519>> = public_keys.iter()
            .map(|pk| serializable_to_point(pk))
            .collect::<Result<Vec<_>>>()?;
        
        let bc1_vec: Vec<thresholdsig::KeyGenBroadcastMessage1> = commitments.iter()
            .map(|com| thresholdsig::KeyGenBroadcastMessage1 { com: serializable_to_bigint(com) })
            .collect();

        let (vss, secret_shares) = key.phase1_verify_com_phase2_distribute(
            &params,
            &blind_vec,
            &y_vec,
            &bc1_vec,
            &parties,
        ).map_err(|e| napi::Error::new(Status::GenericFailure, format!("{:?}", e)))?;

        // Serialize VSS
        let vss_serializable = SerializableVerifiableSS {
            threshold: vss.parameters.threshold,
            share_count: vss.parameters.share_count,
            commitments: vss.commitments.iter().map(point_to_serializable).collect(),
        };

        // Access shares using indexing (SecretShares implements Index)
        let secret_shares_serializable: Vec<SerializableScalar> = (0..share_count as usize)
            .map(|i| scalar_to_serializable(&secret_shares[i]))
            .collect();

        let result = serde_json::json!({
            "vss": vss_serializable,
            "secret_shares": secret_shares_serializable
        });
        Ok(result)
    }

    #[napi]
    /// Phase 2 verify VSS and construct keypair
    pub fn phase2_verify_vss_construct_keypair(
        key_id: String,
        threshold: u16,
        share_count: u16,
        public_keys: Vec<SerializablePoint>,
        secret_shares: Vec<SerializableScalar>,
        vss_schemes: Vec<SerializableVerifiableSS>,
        index: u16,
    ) -> Result<SerializableSharedKeys> {
        let mut keys_store = keys_store().lock().unwrap();
        let key = keys_store.get_mut(&key_id)
            .ok_or_else(|| napi::Error::new(Status::InvalidArg, "Key not found"))?;

        let params = Parameters { threshold, share_count };
        
        let y_vec: Vec<Point<Ed25519>> = public_keys.iter()
            .map(|pk| serializable_to_point(pk))
            .collect::<Result<Vec<_>>>()?;
        
        let secret_shares_vec: Vec<Scalar<Ed25519>> = secret_shares.iter()
            .map(|ss| serializable_to_scalar(ss))
            .collect::<Result<Vec<_>>>()?;

        // Reconstruct VSS schemes - need to use the actual parties array [1, 2, ..., share_count]
        let parties: Vec<u16> = (1..=share_count).collect();
        let vss_scheme_vec: Vec<VerifiableSS<Ed25519>> = vss_schemes.iter()
            .map(|vss| {
                let commitments: Vec<Point<Ed25519>> = vss.commitments.iter()
                    .map(|c| serializable_to_point(c))
                    .collect::<Result<Vec<_>>>()?;
                // Create a temporary VerifiableSS to get the parameters structure
                // Use the actual parties array to match the original VSS structure
                let (temp_vss, _) = VerifiableSS::share_at_indices(
                    vss.threshold,
                    vss.share_count,
                    &Scalar::<Ed25519>::zero(), // dummy scalar, we only need the structure
                    &parties,
                );
                Ok(VerifiableSS {
                    parameters: temp_vss.parameters,
                    commitments,
                })
            })
            .collect::<Result<Vec<_>>>()?;

        let shared_keys = key.phase2_verify_vss_construct_keypair(
            &params,
            &y_vec,
            &secret_shares_vec,
            &vss_scheme_vec,
            index,
        ).map_err(|e| napi::Error::new(Status::GenericFailure, format!("{:?}", e)))?;

        // prefix is a public field, so we can access it directly
        Ok(SerializableSharedKeys {
            y: point_to_serializable(&shared_keys.y),
            x_i: scalar_to_serializable(&shared_keys.x_i),
            prefix: scalar_to_serializable(&shared_keys.prefix),
        })
    }

    #[napi]
    /// Create ephemeral key from deterministic secret
    pub fn ephemeral_key_create(key_id: String, message: Vec<u8>, index: u16) -> Result<String> {
        let keys_store = keys_store().lock().unwrap();
        let key = keys_store.get(&key_id)
            .ok_or_else(|| napi::Error::new(Status::InvalidArg, "Key not found"))?;

        let ephemeral_key = EphemeralKey::ephermeral_key_create_from_deterministic_secret(
            key,
            &message,
            index,
        );

        let eph_key_id = format!("eph_{}_{}", key_id, index);
        ephemeral_keys_store().lock().unwrap().insert(eph_key_id.clone(), ephemeral_key);
        Ok(eph_key_id)
    }

    #[napi]
    /// Get ephemeral R point
    pub fn get_ephemeral_R(eph_key_id: String) -> Result<SerializablePoint> {
        let eph_keys_store = ephemeral_keys_store().lock().unwrap();
        let eph_key = eph_keys_store.get(&eph_key_id)
            .ok_or_else(|| napi::Error::new(Status::InvalidArg, "Ephemeral key not found"))?;
        Ok(point_to_serializable(&eph_key.R_i))
    }

    #[napi]
    /// Ephemeral Phase 1 broadcast
    pub fn ephemeral_phase1_broadcast(eph_key_id: String) -> Result<serde_json::Value> {
        let mut eph_keys_store = ephemeral_keys_store().lock().unwrap();
        let eph_key = eph_keys_store.get_mut(&eph_key_id)
            .ok_or_else(|| napi::Error::new(Status::InvalidArg, "Ephemeral key not found"))?;

        let (bcm1, blind_factor) = eph_key.phase1_broadcast();
        
        let result = serde_json::json!({
            "commitment": bigint_to_serializable(&bcm1.com),
            "blind_factor": bigint_to_serializable(&blind_factor)
        });
        Ok(result)
    }

    #[napi]
    /// Ephemeral Phase 1 verify and Phase 2 distribute
    pub fn ephemeral_phase1_verify_com_phase2_distribute(
        eph_key_id: String,
        threshold: u16,
        share_count: u16,
        blind_factors: Vec<SerializableBigInt>,
        R_points: Vec<SerializablePoint>,
        commitments: Vec<SerializableBigInt>,
        parties: Vec<u16>,
    ) -> Result<serde_json::Value> {
        let mut eph_keys_store = ephemeral_keys_store().lock().unwrap();
        let eph_key = eph_keys_store.get_mut(&eph_key_id)
            .ok_or_else(|| napi::Error::new(Status::InvalidArg, "Ephemeral key not found"))?;

        let params = Parameters { threshold, share_count };
        
        let blind_vec: Vec<BigInt> = blind_factors.iter().map(serializable_to_bigint).collect();
        let R_vec: Vec<Point<Ed25519>> = R_points.iter()
            .map(|r| serializable_to_point(r))
            .collect::<Result<Vec<_>>>()?;
        
        let bc1_vec: Vec<thresholdsig::KeyGenBroadcastMessage1> = commitments.iter()
            .map(|com| thresholdsig::KeyGenBroadcastMessage1 { com: serializable_to_bigint(com) })
            .collect();

        let (vss, secret_shares) = eph_key.phase1_verify_com_phase2_distribute(
            &params,
            &blind_vec,
            &R_vec,
            &bc1_vec,
            &parties,
        ).map_err(|e| napi::Error::new(Status::GenericFailure, format!("{:?}", e)))?;

        let vss_serializable = SerializableVerifiableSS {
            threshold: vss.parameters.threshold,
            share_count: vss.parameters.share_count,
            commitments: vss.commitments.iter().map(point_to_serializable).collect(),
        };

        // Access shares using indexing (SecretShares implements Index)
        let secret_shares_serializable: Vec<SerializableScalar> = (0..share_count as usize)
            .map(|i| scalar_to_serializable(&secret_shares[i]))
            .collect();

        let result = serde_json::json!({
            "vss": vss_serializable,
            "secret_shares": secret_shares_serializable
        });
        Ok(result)
    }

    #[napi]
    /// Ephemeral Phase 2 verify and construct keypair
    pub fn ephemeral_phase2_verify_vss_construct_keypair(
        eph_key_id: String,
        threshold: u16,
        share_count: u16,
        R_points: Vec<SerializablePoint>,
        secret_shares: Vec<SerializableScalar>,
        vss_schemes: Vec<SerializableVerifiableSS>,
        index: u16,
    ) -> Result<SerializableEphemeralSharedKeys> {
        let mut eph_keys_store = ephemeral_keys_store().lock().unwrap();
        let eph_key = eph_keys_store.get_mut(&eph_key_id)
            .ok_or_else(|| napi::Error::new(Status::InvalidArg, "Ephemeral key not found"))?;

        let params = Parameters { threshold, share_count };
        
        let R_vec: Vec<Point<Ed25519>> = R_points.iter()
            .map(|r| serializable_to_point(r))
            .collect::<Result<Vec<_>>>()?;
        
        let secret_shares_vec: Vec<Scalar<Ed25519>> = secret_shares.iter()
            .map(|ss| serializable_to_scalar(ss))
            .collect::<Result<Vec<_>>>()?;

        // Reconstruct VSS schemes - need to use the actual parties array
        let parties: Vec<u16> = (1..=share_count).collect();
        let vss_scheme_vec: Vec<VerifiableSS<Ed25519>> = vss_schemes.iter()
            .map(|vss| {
                let commitments: Vec<Point<Ed25519>> = vss.commitments.iter()
                    .map(|c| serializable_to_point(c))
                    .collect::<Result<Vec<_>>>()?;
                // Create a temporary VerifiableSS to get the parameters structure
                // Use the actual parties array to match the original VSS structure
                let (temp_vss, _) = VerifiableSS::share_at_indices(
                    vss.threshold,
                    vss.share_count,
                    &Scalar::<Ed25519>::zero(), // dummy scalar, we only need the structure
                    &parties,
                );
                Ok(VerifiableSS {
                    parameters: temp_vss.parameters,
                    commitments,
                })
            })
            .collect::<Result<Vec<_>>>()?;

        let ephemeral_shared_keys = eph_key.phase2_verify_vss_construct_keypair(
            &params,
            &R_vec,
            &secret_shares_vec,
            &vss_scheme_vec,
            index,
        ).map_err(|e| napi::Error::new(Status::GenericFailure, format!("{:?}", e)))?;

        Ok(SerializableEphemeralSharedKeys {
            R: point_to_serializable(&ephemeral_shared_keys.R),
            r_i: scalar_to_serializable(&ephemeral_shared_keys.r_i),
        })
    }

    #[napi]
    /// Compute local signature
    pub fn compute_local_sig(
        message: Vec<u8>,
        ephemeral_shared_keys: SerializableEphemeralSharedKeys,
        shared_keys: SerializableSharedKeys,
    ) -> Result<SerializableLocalSig> {
        let local_eph_key = EphemeralSharedKeys {
            R: serializable_to_point(&ephemeral_shared_keys.R)?,
            r_i: serializable_to_scalar(&ephemeral_shared_keys.r_i)?,
        };

        let local_private_key = SharedKeys {
            y: serializable_to_point(&shared_keys.y)?,
            x_i: serializable_to_scalar(&shared_keys.x_i)?,
            prefix: serializable_to_scalar(&shared_keys.prefix)?,
        };

        let local_sig = LocalSig::compute(&message, &local_eph_key, &local_private_key);

        Ok(SerializableLocalSig {
            gamma_i: scalar_to_serializable(&local_sig.gamma_i),
            k: scalar_to_serializable(&local_sig.k),
        })
    }

    #[napi]
    /// Verify local signatures
    pub fn verify_local_sigs(
        local_sigs: Vec<SerializableLocalSig>,
        parties_index: Vec<u16>,
        vss_private_keys: Vec<SerializableVerifiableSS>,
        vss_ephemeral_keys: Vec<SerializableVerifiableSS>,
    ) -> Result<SerializableVerifiableSS> {
        let local_sig_vec: Vec<LocalSig> = local_sigs.iter()
            .map(|ls| LocalSig {
                gamma_i: serializable_to_scalar(&ls.gamma_i).unwrap(),
                k: serializable_to_scalar(&ls.k).unwrap(),
            })
            .collect();

        // Reconstruct VSS schemes - need to use the actual parties array
        // Key generation VSS uses the original share_count (total parties)
        let keygen_parties: Vec<u16> = (1..=vss_private_keys[0].share_count).collect();
        let vss_private_keys_vec: Vec<VerifiableSS<Ed25519>> = vss_private_keys.iter()
            .map(|vss| {
                let commitments: Vec<Point<Ed25519>> = vss.commitments.iter()
                    .map(|c| serializable_to_point(c))
                    .collect::<Result<Vec<_>>>()?;
                // Create a temporary VerifiableSS to get the parameters structure
                // Use the key generation parties array to match the original VSS structure
                let (temp_vss, _) = VerifiableSS::share_at_indices(
                    vss.threshold,
                    vss.share_count,
                    &Scalar::<Ed25519>::zero(), // dummy scalar, we only need the structure
                    &keygen_parties,
                );
                Ok(VerifiableSS {
                    parameters: temp_vss.parameters,
                    commitments,
                })
            })
            .collect::<Result<Vec<_>>>()?;

        // Ephemeral VSS uses the actual number of signing parties
        let eph_parties: Vec<u16> = if vss_ephemeral_keys.len() > 0 {
            (1..=vss_ephemeral_keys[0].share_count).collect()
        } else {
            keygen_parties.clone()
        };
        let vss_ephemeral_keys_vec: Vec<VerifiableSS<Ed25519>> = vss_ephemeral_keys.iter()
            .map(|vss| {
                let commitments: Vec<Point<Ed25519>> = vss.commitments.iter()
                    .map(|c| serializable_to_point(c))
                    .collect::<Result<Vec<_>>>()?;
                // Create a temporary VerifiableSS to get the parameters structure
                // Use the ephemeral parties array to match the ephemeral VSS structure
                let (temp_vss, _) = VerifiableSS::share_at_indices(
                    vss.threshold,
                    vss.share_count,
                    &Scalar::<Ed25519>::zero(), // dummy scalar, we only need the structure
                    &eph_parties,
                );
                Ok(VerifiableSS {
                    parameters: temp_vss.parameters,
                    commitments,
                })
            })
            .collect::<Result<Vec<_>>>()?;

        let vss_sum = LocalSig::verify_local_sigs(
            &local_sig_vec,
            &parties_index,
            &vss_private_keys_vec,
            &vss_ephemeral_keys_vec,
        ).map_err(|e| napi::Error::new(Status::GenericFailure, format!("{:?}", e)))?;

        Ok(SerializableVerifiableSS {
            threshold: vss_sum.parameters.threshold,
            share_count: vss_sum.parameters.share_count,
            commitments: vss_sum.commitments.iter().map(point_to_serializable).collect(),
        })
    }

    #[napi]
    /// Generate final signature
    pub fn generate_signature(
        vss_sum_local_sigs: SerializableVerifiableSS,
        local_sigs: Vec<SerializableLocalSig>,
        parties_index: Vec<u16>,
        R: SerializablePoint,
    ) -> Result<SerializableSignature> {
        // Reconstruct VSS sum - need to use the actual parties array
        let parties: Vec<u16> = (1..=vss_sum_local_sigs.share_count).collect();
        let vss_sum: VerifiableSS<Ed25519> = {
            let commitments: Vec<Point<Ed25519>> = vss_sum_local_sigs.commitments.iter()
                .map(|c| serializable_to_point(c))
                .collect::<Result<Vec<_>>>()?;
            // Create a temporary VerifiableSS to get the parameters structure
            // Use the actual parties array to match the original VSS structure
            let (temp_vss, _) = VerifiableSS::share_at_indices(
                vss_sum_local_sigs.threshold,
                vss_sum_local_sigs.share_count,
                &Scalar::<Ed25519>::zero(), // dummy scalar, we only need the structure
                &parties,
            );
            VerifiableSS {
                parameters: temp_vss.parameters,
                commitments,
            }
        };

        let local_sig_vec: Vec<LocalSig> = local_sigs.iter()
            .map(|ls| LocalSig {
                gamma_i: serializable_to_scalar(&ls.gamma_i).unwrap(),
                k: serializable_to_scalar(&ls.k).unwrap(),
            })
            .collect();

        let R_point = serializable_to_point(&R)?;

        let signature = thresholdsig::generate(
            &vss_sum,
            &local_sig_vec,
            &parties_index,
            R_point,
        );

        Ok(SerializableSignature {
            R: point_to_serializable(&signature.R),
            s: scalar_to_serializable(&signature.s),
        })
    }

    #[napi]
    /// Verify signature
    pub fn verify_signature(
        signature: SerializableSignature,
        message: Vec<u8>,
        public_key: SerializablePoint,
    ) -> Result<bool> {
        let sig = multi_party_eddsa::protocols::Signature {
            R: serializable_to_point(&signature.R)?,
            s: serializable_to_scalar(&signature.s)?,
        };

        let pk = serializable_to_point(&public_key)?;

        match sig.verify(&message, &pk) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }
}

