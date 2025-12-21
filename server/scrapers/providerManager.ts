/**
 * Provider Manager - Handles multiple scraping providers with fallback and circuit breaking
 */

import { ScraperProvider, ScrapeResult, Platform, CircuitBreakerConfig } from './types';
import { CircuitBreaker } from './circuitBreaker';
import { ScrapeCreatorsProvider } from './scrapeCreatorsProvider';
import { ApifyProvider } from './apifyProvider';

interface ProviderConfig {
  name: string;
  priority: number;
  provider: ScraperProvider;
  circuitBreaker: CircuitBreaker;
}

interface ManagerConfig {
  maxRetries?: number;
  retryDelayMs?: number;
  timeout?: number;
  circuitBreakerConfig?: CircuitBreakerConfig;
}

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5, // Open circuit after 5 consecutive failures
  resetTimeout: 60000, // Try again after 1 minute
  monitoringWindow: 300000, // Track failures over 5 minutes
};

export class ProviderManager {
  private providers: ProviderConfig[] = [];
  private config: Required<ManagerConfig>;

  constructor(config: ManagerConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? parseInt(process.env.SCRAPING_MAX_RETRIES || '3', 10),
      retryDelayMs: config.retryDelayMs ?? parseInt(process.env.SCRAPING_RETRY_DELAY_MS || '1000', 10),
      timeout: config.timeout ?? parseInt(process.env.SCRAPING_TIMEOUT_MS || '30000', 10),
      circuitBreakerConfig: config.circuitBreakerConfig ?? DEFAULT_CIRCUIT_BREAKER_CONFIG,
    };

    this.initializeProviders();
  }

  private initializeProviders(): void {
    const primaryProvider = process.env.SCRAPING_PROVIDER || 'scrapecreators';

    // Initialize ScrapeCreators if API key is available
    if (process.env.SCRAPECREATORS_API_KEY) {
      const scrapeCreators = new ScrapeCreatorsProvider({
        apiKey: process.env.SCRAPECREATORS_API_KEY,
        timeout: this.config.timeout,
      });

      this.providers.push({
        name: 'scrapecreators',
        priority: primaryProvider === 'scrapecreators' ? 1 : 2,
        provider: scrapeCreators,
        circuitBreaker: new CircuitBreaker(this.config.circuitBreakerConfig),
      });

      console.log('✓ ScrapeCreators provider initialized');
    } else {
      console.warn('⚠ SCRAPECREATORS_API_KEY not found - ScrapeCreators provider disabled');
    }

    // Initialize Apify if API token is available
    if (process.env.APIFY_API_TOKEN) {
      const apify = new ApifyProvider({
        apiToken: process.env.APIFY_API_TOKEN,
        timeout: this.config.timeout,
      });

      this.providers.push({
        name: 'apify',
        priority: primaryProvider === 'apify' ? 1 : 2,
        provider: apify,
        circuitBreaker: new CircuitBreaker(this.config.circuitBreakerConfig),
      });

      console.log('✓ Apify provider initialized');
    } else {
      console.warn('⚠ APIFY_API_TOKEN not found - Apify provider disabled');
    }

    // Sort by priority (lower number = higher priority)
    this.providers.sort((a, b) => a.priority - b.priority);

    if (this.providers.length === 0) {
      throw new Error('No scraping providers configured. Please set SCRAPECREATORS_API_KEY or APIFY_API_TOKEN');
    }

    console.log(`Primary provider: ${this.providers[0].name}`);
    if (this.providers.length > 1) {
      console.log(`Fallback providers: ${this.providers.slice(1).map(p => p.name).join(', ')}`);
    }
  }

  /**
   * Scrape with automatic fallback to secondary providers
   */
  async scrape(url: string, platform: Platform): Promise<ScrapeResult> {
    let lastError: Error | undefined;
    const attemptedProviders: string[] = [];

    // Try each provider in priority order
    for (const providerConfig of this.providers) {
      // Skip if circuit breaker is open
      if (providerConfig.circuitBreaker.getState() === 'OPEN') {
        console.log(`Skipping ${providerConfig.name} - circuit breaker OPEN`);
        continue;
      }

      attemptedProviders.push(providerConfig.name);

      try {
        // Execute with circuit breaker and retry logic
        const result = await this.scrapeWithRetry(providerConfig, url, platform);

        if (result.success) {
          console.log(`✓ Successfully scraped ${platform} via ${providerConfig.name} in ${result.responseTime}ms`);
          return result;
        }

        // If unsuccessful but not an error (e.g., post deleted), don't try fallback
        if (this.isPermanentFailure(result.error)) {
          console.log(`Permanent failure from ${providerConfig.name}: ${result.error}`);
          return result;
        }

        console.warn(`Provider ${providerConfig.name} failed: ${result.error}`);
        lastError = new Error(result.error);
      } catch (error) {
        console.error(`Error with provider ${providerConfig.name}:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    // All providers failed
    return {
      success: false,
      error: `All providers failed (tried: ${attemptedProviders.join(', ')}). Last error: ${lastError?.message || 'Unknown error'}`,
      provider: 'none',
    };
  }

  /**
   * Scrape with retry logic and circuit breaker
   */
  private async scrapeWithRetry(
    providerConfig: ProviderConfig,
    url: string,
    platform: Platform
  ): Promise<ScrapeResult> {
    let lastResult: ScrapeResult | undefined;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // Execute through circuit breaker
        lastResult = await providerConfig.circuitBreaker.execute(() =>
          providerConfig.provider.scrape(url, platform)
        );

        // Check if we should retry
        if (lastResult.success || this.isPermanentFailure(lastResult.error)) {
          return lastResult;
        }

        // Retry for temporary failures
        if (attempt < this.config.maxRetries - 1 && this.isRetriableError(lastResult.error)) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          console.log(
            `Retry attempt ${attempt + 1}/${this.config.maxRetries} for ${providerConfig.name} after ${delay}ms`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        return lastResult;
      } catch (error) {
        // Circuit breaker is open or other error
        if (error instanceof Error && error.message.includes('Circuit breaker OPEN')) {
          throw error;
        }

        // Retry on exceptions
        if (attempt < this.config.maxRetries - 1) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          console.log(`Exception on attempt ${attempt + 1}, retrying after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      }
    }

    return lastResult || {
      success: false,
      error: 'Max retries exceeded',
      provider: providerConfig.name,
    };
  }

  /**
   * Check if error is a permanent failure (don't retry, don't fallback)
   */
  private isPermanentFailure(error?: string): boolean {
    if (!error) return false;

    const permanentErrors = [
      'private or deleted',
      'not found',
      'invalid url',
      'authentication required',
      'not configured',
      'post may be private',
    ];

    const errorLower = error.toLowerCase();
    return permanentErrors.some(pattern => errorLower.includes(pattern));
  }

  /**
   * Check if error is retriable (temporary failure)
   */
  private isRetriableError(error?: string): boolean {
    if (!error) return false;

    const retriablePatterns = [
      'timeout',
      'network',
      'connection',
      'ECONNRESET',
      'ETIMEDOUT',
      'temporary',
      '429',
      '503',
      '502',
      '500',
    ];

    const errorLower = error.toLowerCase();
    return retriablePatterns.some(pattern => errorLower.includes(pattern));
  }

  /**
   * Get stats for all providers
   */
  getProvidersStats() {
    return this.providers.map(p => ({
      name: p.name,
      priority: p.priority,
      stats: p.provider.getStats(),
      circuitBreaker: p.circuitBreaker.getStats(),
      healthy: p.provider.isHealthy(),
    }));
  }

  /**
   * Reset circuit breakers (useful for manual recovery)
   */
  resetCircuitBreakers(): void {
    this.providers.forEach(p => p.circuitBreaker.reset());
    console.log('All circuit breakers reset');
  }
}

// Singleton instance
let managerInstance: ProviderManager | null = null;

export function getProviderManager(): ProviderManager {
  if (!managerInstance) {
    managerInstance = new ProviderManager();
  }
  return managerInstance;
}

export function resetProviderManager(): void {
  managerInstance = null;
}
