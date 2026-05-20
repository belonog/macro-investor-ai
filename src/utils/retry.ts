import axios from 'axios';
import { logger } from './logger.js';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
}

/**
 * Utility to run an async function with exponential backoff and jitter.
 * Specifically targets transient network errors and rate limits (429, 5xx).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 4000,
    backoffFactor = 2,
  } = options;

  let attempt = 0;
  let delayMs = initialDelayMs;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;

      const isAxiosError = axios.isAxiosError(error);
      let isTransient = false;

      if (isAxiosError) {
        const status = error.response?.status;
        const code = error.code;
        
        // 429 Too Many Requests
        // 500+ Server Errors
        if (status && (status === 429 || status >= 500)) {
          isTransient = true;
        }

        // Network errors
        if (code && ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNABORTED'].includes(code)) {
          isTransient = true;
        }
      }

      if (!isTransient || attempt > maxRetries) {
        throw error;
      }

      // Calculate jittered delay
      // Jitter avoids thundering herd problems when many parallel requests fail
      const jitter = Math.random() * 0.3 * delayMs; // +/- 15% jitter roughly
      const actualDelay = Math.min(delayMs + jitter, maxDelayMs);

      logger.warn(`Transient error in fetcher. Retrying attempt ${attempt}/${maxRetries} after ${Math.round(actualDelay)}ms...`);
      
      await new Promise((resolve) => setTimeout(resolve, actualDelay));
      
      // Exponential backoff for next attempt
      delayMs = Math.min(delayMs * backoffFactor, maxDelayMs);
    }
  }
}
