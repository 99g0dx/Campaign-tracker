/**
 * ScrapeCreators API Provider
 * Documentation: https://scrapecreators.com/docs
 */

import { ScraperProvider, ScrapeResult, Platform, ProviderStats, ScrapedData } from './types';

interface ScrapeCreatorsConfig {
  apiKey: string;
  timeout?: number;
}

// ScrapeCreators API response types
interface TikTokResponse {
  video?: {
    id: string;
    playCount?: number;
    diggCount?: number;
    commentCount?: number;
    shareCount?: number;
  };
}

interface InstagramResponse {
  likeCount?: number;
  commentCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  id?: string;
}

interface YouTubeResponse {
  viewCount?: string;
  likeCount?: string;
  commentCount?: string;
  id?: string;
}

export class ScrapeCreatorsProvider implements ScraperProvider {
  name = 'scrapecreators';
  private baseUrl = 'https://api.scrapecreators.com/v1';
  private stats: ProviderStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    consecutiveFailures: 0,
  };

  constructor(private config: ScrapeCreatorsConfig) {}

  async scrape(url: string, platform: Platform): Promise<ScrapeResult> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      let data: ScrapedData;

      switch (platform) {
        case 'tiktok':
          data = await this.scrapeTikTok(url);
          break;
        case 'instagram':
          data = await this.scrapeInstagram(url);
          break;
        case 'youtube':
          data = await this.scrapeYouTube(url);
          break;
        case 'twitter':
          data = await this.scrapeTwitter(url);
          break;
        default:
          throw new Error(`Platform ${platform} not supported by ScrapeCreators`);
      }

      const responseTime = Date.now() - startTime;
      this.updateStats(true, responseTime);

      return {
        success: true,
        data,
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

  private async scrapeTikTok(url: string): Promise<ScrapedData> {
    const endpoint = `${this.baseUrl}/tiktok/post`;
    const response = await this.makeRequest<TikTokResponse>(endpoint, { url });

    const video = response.video;
    if (!video) {
      throw new Error('No video data returned from ScrapeCreators');
    }

    const views = video.playCount || 0;
    const likes = video.diggCount || 0;
    const comments = video.commentCount || 0;
    const shares = video.shareCount || 0;
    const engagementRate = views > 0 ? ((likes + comments + shares) / views) * 100 : 0;

    return {
      views,
      likes,
      comments,
      shares,
      engagementRate,
      postId: video.id,
    };
  }

  private async scrapeInstagram(url: string): Promise<ScrapedData> {
    const endpoint = `${this.baseUrl}/instagram/post`;
    const response = await this.makeRequest<InstagramResponse>(endpoint, { url });

    const likes = response.likeCount || 0;
    const comments = response.commentCount || 0;
    const views = response.videoViewCount || response.videoPlayCount || 0;
    const shares = 0; // Instagram API doesn't provide share count
    const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;

    return {
      views,
      likes,
      comments,
      shares,
      engagementRate,
      postId: response.id,
    };
  }

  private async scrapeYouTube(url: string): Promise<ScrapedData> {
    const endpoint = `${this.baseUrl}/youtube/video`;
    const response = await this.makeRequest<YouTubeResponse>(endpoint, { url });

    const views = parseInt(response.viewCount || '0', 10);
    const likes = parseInt(response.likeCount || '0', 10);
    const comments = parseInt(response.commentCount || '0', 10);
    const shares = 0; // YouTube API doesn't provide share count via ScrapeCreators
    const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;

    return {
      views,
      likes,
      comments,
      shares,
      engagementRate,
      postId: response.id,
    };
  }

  private async scrapeTwitter(url: string): Promise<ScrapedData> {
    const endpoint = `${this.baseUrl}/twitter/tweet`;
    const response = await this.makeRequest<any>(endpoint, { url });

    const views = response.viewCount || 0;
    const likes = response.favoriteCount || 0;
    const comments = response.replyCount || 0;
    const shares = response.retweetCount || 0;
    const engagementRate = views > 0 ? ((likes + comments + shares) / views) * 100 : 0;

    return {
      views,
      likes,
      comments,
      shares,
      engagementRate,
      postId: response.id_str || response.id,
    };
  }

  private async makeRequest<T>(endpoint: string, body: any): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout || 30000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ScrapeCreators API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - ScrapeCreators did not respond in time');
      }
      throw error;
    }
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

    // Update rolling average response time
    const totalResponses = this.stats.successfulRequests + this.stats.failedRequests;
    this.stats.averageResponseTime =
      (this.stats.averageResponseTime * (totalResponses - 1) + responseTime) / totalResponses;
  }

  isHealthy(): boolean {
    // Consider unhealthy if more than 3 consecutive failures
    return this.stats.consecutiveFailures < 3;
  }

  getStats(): ProviderStats {
    return { ...this.stats };
  }
}
