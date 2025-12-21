/**
 * Common types and interfaces for scraping providers
 */

export type Platform = 'tiktok' | 'instagram' | 'youtube' | 'twitter' | 'facebook';

export interface ScrapedData {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  postId?: string;
}

export interface ScrapeResult {
  success: boolean;
  data?: ScrapedData;
  error?: string;
  provider: string;
  responseTime?: number;
}

export interface ScraperProvider {
  name: string;
  scrape(url: string, platform: Platform): Promise<ScrapeResult>;
  isHealthy(): boolean;
  getStats(): ProviderStats;
}

export interface ProviderStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastFailureTime?: number;
  consecutiveFailures: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of consecutive failures before opening
  resetTimeout: number; // Time in ms before attempting to close circuit
  monitoringWindow: number; // Time window for tracking failures
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
