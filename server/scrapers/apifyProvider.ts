/**
 * Apify API Provider (Legacy fallback)
 * Wraps existing Apify implementation
 */

import { ScraperProvider, ScrapeResult, Platform, ProviderStats } from './types';

interface ApifyConfig {
  apiToken: string;
  timeout?: number;
}

export class ApifyProvider implements ScraperProvider {
  name = 'apify';
  private stats: ProviderStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    consecutiveFailures: 0,
  };

  constructor(private config: ApifyConfig) {}

  async scrape(url: string, platform: Platform): Promise<ScrapeResult> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      let result: ScrapeResult;

      switch (platform) {
        case 'tiktok':
          result = await this.scrapeTikTok(url);
          break;
        case 'instagram':
          result = await this.scrapeInstagram(url);
          break;
        default:
          throw new Error(`Platform ${platform} not supported by Apify provider`);
      }

      const responseTime = Date.now() - startTime;
      this.updateStats(result.success, responseTime);

      return {
        ...result,
        provider: this.name,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateStats(false, responseTime);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        provider: this.name,
        responseTime,
      };
    }
  }

  private async scrapeTikTok(url: string): Promise<ScrapeResult> {
    const actorId = 'clockworks~tiktok-video-scraper';
    const apiUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${this.config.apiToken}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        postURLs: [url],
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 402) {
        throw new Error('Apify credit limit reached');
      }
      throw new Error(`Apify API error (${response.status}): ${errorText.substring(0, 200)}`);
    }

    const results = await response.json();

    if (!results || results.length === 0) {
      return {
        success: false,
        error: 'No data returned from TikTok scraper. The post may be private or deleted.',
        provider: this.name,
      };
    }

    const video = results[0];

    if (video.error) {
      return {
        success: false,
        error: video.error,
        provider: this.name,
      };
    }

    const views = video.playCount || video.plays || 0;
    const likes = video.diggCount || video.hearts || 0;
    const comments = video.commentCount || 0;
    const shares = video.shareCount || 0;
    const totalEngagement = likes + comments + shares;
    const engagementRate = views > 0 ? (totalEngagement / views) * 100 : 0;

    return {
      success: true,
      data: {
        views,
        likes,
        comments,
        shares,
        engagementRate: Math.round(engagementRate * 100) / 100,
        postId: video.id,
      },
      provider: this.name,
    };
  }

  private async scrapeInstagram(url: string): Promise<ScrapeResult> {
    const actorId = 'apify~instagram-scraper';
    const apiUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${this.config.apiToken}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        directUrls: [url],
        resultsLimit: 1,
        resultsType: 'posts',
        addParentData: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 402) {
        throw new Error('Apify credit limit reached');
      }
      throw new Error(`Apify API error (${response.status}): ${errorText.substring(0, 200)}`);
    }

    const results = await response.json();

    if (!results || results.length === 0) {
      return {
        success: false,
        error: 'No data returned from Instagram scraper. The post may be private or deleted.',
        provider: this.name,
      };
    }

    const post = results[0];
    const views = post.videoViewCount || post.videoPlayCount || 0;
    const likes = post.likesCount || post.likes || 0;
    const comments = post.commentsCount || post.comments || 0;
    const shares = 0;
    const totalEngagement = likes + comments + shares;
    const engagementRate = views > 0 ? (totalEngagement / views) * 100 : likes > 0 ? 100 : 0;

    return {
      success: true,
      data: {
        views,
        likes,
        comments,
        shares,
        engagementRate: Math.round(engagementRate * 100) / 100,
        postId: post.shortCode || post.id,
      },
      provider: this.name,
    };
  }

  private updateStats(success: boolean, responseTime: number): void {
    if (success) {
      this.stats.successfulRequests++;
      this.stats.consecutiveFailures = 0;
    } else {
      this.stats.failedRequests++;
      this.stats.consecutiveFailures++;
      this.stats.lastFailureTime = Date.now();
    }

    const totalResponses = this.stats.successfulRequests + this.stats.failedRequests;
    this.stats.averageResponseTime =
      (this.stats.averageResponseTime * (totalResponses - 1) + responseTime) / totalResponses;
  }

  isHealthy(): boolean {
    return this.stats.consecutiveFailures < 3;
  }

  getStats(): ProviderStats {
    return { ...this.stats };
  }
}
