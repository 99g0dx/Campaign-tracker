import { describe, expect, it } from 'vitest';
import { isPlaceholderPost, isScrapedPost, dedupePosts, filterPostsByWindow, computeTotals, groupByDay } from '../postUtils';

const now = Date.now();

describe('postUtils', () => {
  it('identifies placeholder posts', () => {
    expect(isPlaceholderPost({ url: 'placeholder://abc', platform: null, postStatus: 'pending', views: 0, likes: 0, comments: 0, shares: 0 })).toBe(true);
    expect(isPlaceholderPost({ url: 'https://tiktok.com', platform: 'tiktok', postStatus: 'active', views: 100 })).toBe(false);
    expect(isPlaceholderPost({ url: 'https://x', platform: 'instagram', postStatus: 'pending', views: 0, likes: 0, comments: 0, shares: 0 })).toBe(true);
  });

  it('recognizes scraped posts', () => {
    expect(isScrapedPost({ isScraped: true })).toBe(true);
    expect(isScrapedPost({ lastScrapedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() })).toBe(true);
    expect(isScrapedPost({ lastScrapedAt: 'invalid-date' })).toBe(false);
    expect(isScrapedPost({})).toBe(false);
  });

  it('dedupes posts by id/url', () => {
    const posts = [
      { id: 1, url: 'a' },
      { id: 2, url: 'b' },
      { id: 3, url: 'a' },
      { url: 'c' },
      { url: 'c' },
    ];
    const result = dedupePosts(posts as any);
    expect(result.length).toBe(3);
  });

  it('filters by window correctly', () => {
    const posts = [
      { id: 1, lastScrapedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() }, // 2h ago
      { id: 2, lastScrapedAt: new Date(now - 26 * 60 * 60 * 1000).toISOString() }, // 26h ago
    ];
    const last24 = filterPostsByWindow(posts as any, '24h');
    expect(last24.map(p => p.id)).toEqual([1]);
    const last72 = filterPostsByWindow(posts as any, '72h');
    expect(last72.map(p => p.id).sort()).toEqual([1, 2]);
  });

  it('computes totals and engagement', () => {
    const posts = [
      { views: 10, likes: 1, comments: 2, shares: 0 },
      { views: 20, likes: 3, comments: 0, shares: 1 },
    ];
    const totals = computeTotals(posts as any);
    expect(totals.totalViews).toBe(30);
    expect(totals.totalLikes).toBe(4);
    expect(totals.totalComments).toBe(2);
    expect(totals.totalShares).toBe(1);
    expect(totals.totalEngagement).toBe(7);
  });

  it('groups by day for metric', () => {
    const posts = [
      { lastScrapedAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(), views: 5 },
      { lastScrapedAt: new Date(now).toISOString(), views: 10 },
    ];

    const series = groupByDay(posts as any, 'views', '7d');
    // series length should be 7 (7d window)
    expect(series.length).toBeGreaterThanOrEqual(2);
    const total = series.reduce((s: number, d: any) => s + d.value, 0);
    expect(total).toBe(15);
  });
});
