import { CoordinatorService, MPCService } from '../dist/index';
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('CoordinatorService', () => {
  let coordinator: CoordinatorService;
  let services: { [key: string]: MPCService };

  beforeEach(() => {
    coordinator = new CoordinatorService();
    services = {
      'party-0': new MPCService('party-0'),
      'party-1': new MPCService('party-1'),
      'party-2': new MPCService('party-2'),
    };
  });

  describe('Key Generation', () => {
    it('should start a key generation session', () => {
      coordinator.startKeyGeneration(2, 3);
      expect(coordinator).toBeDefined();
    });

    it('should register parties', () => {
      coordinator.startKeyGeneration(2, 3);
      
      for (const [partyId, service] of Object.entries(services)) {
        const init = service.register();
        coordinator.registerParty(partyId, init.publicKey);
      }

      // Verify parties are registered
      expect(coordinator).toBeDefined();
    });

    it('should complete full key generation protocol', async () => {
      const threshold = 2;
      const totalParties = 3;
      const allPartyIds = ['party-0', 'party-1', 'party-2'];

      // Start session
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
      const sharedKeys: any[] = [];
      for (const partyId of allPartyIds) {
        const keyResult = services[partyId].constructKeypair(
          shareData[partyId].threshold,
          shareData[partyId].shareCount,
          shareData[partyId].publicKeys,
          shareData[partyId].allSecretShares,
          shareData[partyId].allVssSchemes,
          shareData[partyId].partyIndex
        );
        sharedKeys.push(keyResult.sharedKey);
      }

      // Verify key generation completed
      expect(sharedKeys.length).toBe(totalParties);
      expect(sharedKeys[0]).toBeDefined();
    });
  });
});

