import { MPCService } from "../dist/index";
import { describe, it, expect, beforeEach } from "@jest/globals";

describe("MPCService", () => {
  let service: MPCService;

  beforeEach(() => {
    service = new MPCService("test-party");
  });

  describe("Initialization", () => {
    it("should create a service with a party ID", () => {
      expect(service).toBeDefined();
    });

    it("should register a party and return public key", () => {
      const result = service.register();
      expect(result).toBeDefined();
      expect(result.publicKey).toBeDefined();
      expect(result.publicKey.bytes).toBeDefined();
    });
  });

  describe("Key Generation", () => {
    it("should generate commitment and blind factor", () => {
      // Service must be registered first
      service.register();
      const result = service.generateCommitment();
      expect(result).toBeDefined();
      expect(result.commitment).toBeDefined();
      expect(result.blindFactor).toBeDefined();
      expect(result.commitment.bytes).toBeDefined();
      expect(result.blindFactor.bytes).toBeDefined();
    });

    it("should distribute secret shares", () => {
      // First register the service
      const init = service.register();

      // Generate commitments (need multiple for distributeShares)
      const commitment1 = service.generateCommitment();
      const commitment2 = service.generateCommitment();

      // For distributeShares, we need public keys from all parties
      // In a real scenario, these would come from other services
      // For testing, we'll use the same service's public key
      const shares = service.distributeShares(
        2, // threshold
        2, // shareCount (number of parties)
        [commitment1.blindFactor, commitment2.blindFactor],
        [init.publicKey, init.publicKey], // Using same key for testing
        [commitment1.commitment, commitment2.commitment],
        0 // partyIndex
      );
      expect(shares).toBeDefined();
      expect(shares.secretShares).toBeDefined();
      expect(shares.vss).toBeDefined();
    });
  });

  describe("Signing", () => {
    it("should generate ephemeral commitment", () => {
      // Service must be registered and ephemeral key created first
      service.register();
      const ephKey = service.createEphemeralKey(Buffer.from("test"), 0);
      const result = service.generateEphemeralCommitment(ephKey.ephKeyId);
      expect(result).toBeDefined();
      expect(result.blindFactor).toBeDefined();
      expect(result.commitment).toBeDefined();
    });

    it("should create ephemeral key", () => {
      // First register the service
      service.register();

      const ephKey = service.createEphemeralKey(Buffer.from("test"), 0);
      expect(ephKey).toBeDefined();
      expect(ephKey.ephKeyId).toBeDefined();
      expect(ephKey.ephR).toBeDefined();
    });
  });
});
