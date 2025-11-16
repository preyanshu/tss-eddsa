import { MPCService, CoordinatorService } from '../dist/index';
import { describe, it, expect } from '@jest/globals';

describe('MPC Integration Tests', () => {
  describe('Full MPC Protocol - 2-of-3 Threshold', () => {
    it('should complete key generation and signing with 2-of-3 threshold', async () => {
      const threshold = 2;
      const totalParties = 3;
      const signingParties = ['party-0', 'party-1'];
      const allPartyIds = ['party-0', 'party-1', 'party-2'];
      const message = Buffer.from('test message for MPC signing');

      // Setup services
      const services: { [key: string]: MPCService } = {};
      for (const partyId of allPartyIds) {
        services[partyId] = new MPCService(partyId);
      }
      const coordinator = new CoordinatorService();

      // ============================================
      // PHASE 1: KEY GENERATION
      // ============================================
      coordinator.startKeyGeneration(threshold, totalParties);

      // Register parties
      const partyInits: { [key: string]: any } = {};
      for (const partyId of allPartyIds) {
        partyInits[partyId] = services[partyId].register();
        coordinator.registerParty(partyId, partyInits[partyId].publicKey);
      }

      // Get commitments
      const partyCommitments: Array<{ partyId: string; commitment: any; blindFactor: any }> = [];
      for (const partyId of allPartyIds) {
        const commit = services[partyId].generateCommitment();
        partyCommitments.push({
          partyId,
          commitment: commit.commitment,
          blindFactor: commit.blindFactor,
        });
      }
      const commitData = coordinator.collectCommitments(partyCommitments);

      // Distribute shares
      const partyShares: Array<{ partyId: string; vss: any; secretShares: any[] }> = [];
      for (let i = 0; i < allPartyIds.length; i++) {
        const partyId = allPartyIds[i];
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

      // Construct keypairs
      const partySharedKeys: Array<{ partyId: string; sharedKey: any }> = [];
      for (const partyId of allPartyIds) {
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

      // Verify key generation
      expect(keygenResult).toBeDefined();
      expect(keygenResult.aggregatePublicKeyHex).toBeDefined();

      // ============================================
      // PHASE 2: SIGNING
      // ============================================
      const signingSession = coordinator.startSigning(message, signingParties);

      // Generate ephemeral keys and commitments
      const partyEphData: Array<{ partyId: string; ephR: any; ephKeyId: string; commitment: any; blindFactor: any }> = [];
      for (let i = 0; i < signingParties.length; i++) {
        const partyId = signingParties[i];
        const eph = services[partyId].startEphemeralKeyGeneration(message, signingSession.signingParties[i]);
        partyEphData.push({ partyId, ...eph });
      }
      const ephCommitData = coordinator.collectEphemeralKeysAndCommitments(partyEphData);

      // Distribute ephemeral shares
      const signingThreshold = threshold;
      const signingShareCount = signingParties.length;
      const partyEphShares: Array<{ partyId: string; vss: any; secretShares: any[] }> = [];
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
          signingSession.signingParties
        );
        partyEphShares.push({ partyId, ...shares });
      }
      const ephShareData = coordinator.collectEphemeralShares(partyEphShares);

      // Construct ephemeral keypairs
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
          signingSession.signingParties
        );
        ephSharedKeys.push(ephResult.ephSharedKey);
      }
      
      // Set coordinator state for ephemeral keys
      (coordinator as any).ephSharedKeys = ephSharedKeys;
      (coordinator as any).allEphVssSchemes = ephShareData[signingParties[0]].allEphVssSchemes;
      (coordinator as any).allVssSchemes = shareData[allPartyIds[0]].allVssSchemes;
      (coordinator as any).signingPartyIndices = signingSession.signingParties;

      // Compute local signatures
      const partyLocalSigs: Array<{ partyId: string; localSig: any }> = [];
      for (let i = 0; i < signingParties.length; i++) {
        const partyId = signingParties[i];
        const localSigResult = services[partyId].computeLocalSignature(message, ephSharedKeys[i]);
        partyLocalSigs.push({ partyId, localSig: localSigResult.localSig });
      }

      // Aggregate signature
      const result = coordinator.collectLocalSignatures(partyLocalSigs);

      // Verify signature
      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(result.signature).toBeDefined();
      expect(result.signatureHex).toBeDefined();
      expect(result.aggregatePublicKeyHex).toBeDefined();
    });

    it('should handle different threshold configurations', async () => {
      const testCases = [
        { threshold: 2, totalParties: 3, signingParties: ['party-0', 'party-1'] },
        { threshold: 2, totalParties: 4, signingParties: ['party-0', 'party-1'] },
        { threshold: 3, totalParties: 5, signingParties: ['party-0', 'party-1', 'party-2'] },
      ];

      for (const testCase of testCases) {
        const { threshold, totalParties, signingParties } = testCase;
        const allPartyIds = Array.from({ length: totalParties }, (_, i) => `party-${i}`);
        const message = Buffer.from(`test message for ${threshold}-of-${totalParties}`);

        // Setup
        const services: { [key: string]: MPCService } = {};
        for (const partyId of allPartyIds) {
          services[partyId] = new MPCService(partyId);
        }
        const coordinator = new CoordinatorService();

        // Key generation
        coordinator.startKeyGeneration(threshold, totalParties);
        for (const partyId of allPartyIds) {
          const init = services[partyId].register();
          coordinator.registerParty(partyId, init.publicKey);
        }

        const partyCommitments: Array<{ partyId: string; commitment: any; blindFactor: any }> = [];
        for (const partyId of allPartyIds) {
          const commit = services[partyId].generateCommitment();
          partyCommitments.push({
            partyId,
            commitment: commit.commitment,
            blindFactor: commit.blindFactor,
          });
        }
        const commitData = coordinator.collectCommitments(partyCommitments);

        const partyShares: Array<{ partyId: string; vss: any; secretShares: any[] }> = [];
        for (let i = 0; i < allPartyIds.length; i++) {
          const partyId = allPartyIds[i];
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

        const partySharedKeys: Array<{ partyId: string; sharedKey: any }> = [];
        for (const partyId of allPartyIds) {
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
        coordinator.collectSharedKeys(partySharedKeys);

        // Signing
        const signingSession = coordinator.startSigning(message, signingParties);

        const partyEphData: Array<{ partyId: string; ephR: any; ephKeyId: string; commitment: any; blindFactor: any }> = [];
        for (let i = 0; i < signingParties.length; i++) {
          const partyId = signingParties[i];
          const eph = services[partyId].startEphemeralKeyGeneration(message, signingSession.signingParties[i]);
          partyEphData.push({ partyId, ...eph });
        }
        const ephCommitData = coordinator.collectEphemeralKeysAndCommitments(partyEphData);

        const signingThreshold = threshold;
        const signingShareCount = signingParties.length;
        const partyEphShares: Array<{ partyId: string; vss: any; secretShares: any[] }> = [];
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
            signingSession.signingParties
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
            signingSession.signingParties
          );
          ephSharedKeys.push(ephResult.ephSharedKey);
        }
        
        // Set coordinator state for ephemeral keys
        (coordinator as any).ephSharedKeys = ephSharedKeys;
        (coordinator as any).allEphVssSchemes = ephShareData[signingParties[0]].allEphVssSchemes;
        (coordinator as any).allVssSchemes = shareData[allPartyIds[0]].allVssSchemes;
        (coordinator as any).signingPartyIndices = signingSession.signingParties;

        const partyLocalSigs: Array<{ partyId: string; localSig: any }> = [];
        for (let i = 0; i < signingParties.length; i++) {
          const partyId = signingParties[i];
          const localSigResult = services[partyId].computeLocalSignature(message, ephSharedKeys[i]);
          partyLocalSigs.push({ partyId, localSig: localSigResult.localSig });
        }

        const result = coordinator.collectLocalSignatures(partyLocalSigs);

        // Verify
        expect(result.isValid).toBe(true);
        expect(result.signature).toBeDefined();
      }
    });
  });
});

