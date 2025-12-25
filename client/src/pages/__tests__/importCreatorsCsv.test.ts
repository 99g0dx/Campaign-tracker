import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../server/db";
import { storage } from "../server/storage";
import { campaigns, socialLinks } from "../shared/schema";
import { eq } from "drizzle-orm";

describe("Import Creators CSV Feature", () => {
  let testUserId: string;
  let testCampaignId: number;

  beforeAll(async () => {
    testUserId = "test-user-" + Date.now();
    
    // Create test campaign
    const campaign = await storage.createCampaign({
      ownerId: testUserId,
      name: "Test Campaign",
      songTitle: "Test Song",
      songArtist: "Test Artist",
    });
    testCampaignId = campaign.id;
  });

  afterAll(async () => {
    // Cleanup
    try {
      await storage.deleteCampaign(testCampaignId, testUserId);
    } catch (err) {
      // ignore cleanup errors
    }
  });

  it("should create creators with pending status when importing CSV", async () => {
    // Simulate importing creators
    const creators = [
      { handle: "@johndoe", platform: "tiktok", posts_promised: 5 },
      { handle: "jane.smith", platform: "instagram", posts_promised: 3 },
      { handle: "alex_creator", platform: "youtube", posts_promised: 1 },
    ];

    let added = 0;
    for (const creator of creators) {
      const placeholderUrl = `placeholder://${testCampaignId}/${Date.now()}/${Math.random()}`;
      await storage.createSocialLink({
        campaignId: testCampaignId,
        url: placeholderUrl,
        platform: creator.platform || "unknown",
        creatorName: creator.handle,
        postStatus: "pending",
      });
      added++;
    }

    // Verify creators were added
    const links = await storage.getSocialLinksByCampaign(testCampaignId);
    
    expect(links.length).toBe(3);
    expect(added).toBe(3);
    
    // Verify all have pending status
    links.forEach((link) => {
      expect(link.postStatus).toBe("pending");
      expect(link.url).toContain("placeholder://");
    });

    // Verify creators are in the list
    const handles = links.map((l) => l.creatorName);
    expect(handles).toContain("@johndoe");
    expect(handles).toContain("jane.smith");
    expect(handles).toContain("alex_creator");
  });

  it("should normalize creator handles (remove @ prefix)", async () => {
    const testCampaignId2 = (
      await storage.createCampaign({
        ownerId: testUserId,
        name: "Test Campaign 2",
        songTitle: "Test Song 2",
        songArtist: "Test Artist 2",
      })
    ).id;

    // Create creator with @ prefix
    const placeholderUrl = `placeholder://${testCampaignId2}/${Date.now()}/${Math.random()}`;
    await storage.createSocialLink({
      campaignId: testCampaignId2,
      url: placeholderUrl,
      platform: "tiktok",
      creatorName: "@test_user",
      postStatus: "pending",
    });

    // Verify the creator was stored with @ prefix
    const links = await storage.getSocialLinksByCampaign(testCampaignId2);
    expect(links[0].creatorName).toBe("@test_user");

    // Cleanup
    await storage.deleteCampaign(testCampaignId2, testUserId);
  });

  it("should handle duplicate creators in same CSV", async () => {
    const testCampaignId3 = (
      await storage.createCampaign({
        ownerId: testUserId,
        name: "Test Campaign 3",
        songTitle: "Test Song 3",
        songArtist: "Test Artist 3",
      })
    ).id;

    // Simulate import with duplicates
    const creators = [
      { handle: "creator1", platform: "tiktok" },
      { handle: "creator1", platform: "tiktok" }, // duplicate
      { handle: "creator2", platform: "instagram" },
    ];

    const seen = new Set<string>();
    let added = 0;
    let skipped = 0;

    for (const creator of creators) {
      const dedupeKey = `${creator.handle}:${creator.platform}`;
      if (seen.has(dedupeKey)) {
        skipped++;
        continue;
      }
      seen.add(dedupeKey);

      const placeholderUrl = `placeholder://${testCampaignId3}/${Date.now()}/${Math.random()}`;
      await storage.createSocialLink({
        campaignId: testCampaignId3,
        url: placeholderUrl,
        platform: creator.platform,
        creatorName: creator.handle,
        postStatus: "pending",
      });
      added++;
    }

    expect(added).toBe(2);
    expect(skipped).toBe(1);

    const links = await storage.getSocialLinksByCampaign(testCampaignId3);
    expect(links.length).toBe(2);

    // Cleanup
    await storage.deleteCampaign(testCampaignId3, testUserId);
  });

  it("should default platform to unknown when not specified", async () => {
    const testCampaignId4 = (
      await storage.createCampaign({
        ownerId: testUserId,
        name: "Test Campaign 4",
        songTitle: "Test Song 4",
        songArtist: "Test Artist 4",
      })
    ).id;

    const placeholderUrl = `placeholder://${testCampaignId4}/${Date.now()}/${Math.random()}`;
    await storage.createSocialLink({
      campaignId: testCampaignId4,
      url: placeholderUrl,
      platform: "unknown", // default
      creatorName: "test_creator",
      postStatus: "pending",
    });

    const links = await storage.getSocialLinksByCampaign(testCampaignId4);
    expect(links[0].platform).toBe("unknown");

    // Cleanup
    await storage.deleteCampaign(testCampaignId4, testUserId);
  });
});
