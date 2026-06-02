/**
 * Creates a rate-limited request queue using a sliding window token bucket.
 * This optimizes execution time while strictly enforcing API rate limits.
 * 
 * @param getLimit Function returning the maximum number of requests allowed within the window.
 * @param getWindowMs Function returning the time window in milliseconds.
 * @returns An `enqueueRequest` function that schedules tasks within the limits.
 */
export function createRateLimitedQueue(getLimit: () => number, getWindowMs: () => number) {
  let queue: Promise<void> = Promise.resolve();
  let requestTimestamps: number[] = [];

  function enqueueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    const next = queue.then(async () => {
      const limit = getLimit();
      const windowMs = getWindowMs();
      
      let now = Date.now();
      
      // Clean up timestamps older than the window
      requestTimestamps = requestTimestamps.filter(t => now - t < windowMs);
      
      if (requestTimestamps.length >= limit) {
        // The oldest relevant request is the first one in the array
        const oldest = requestTimestamps[0];
        const waitTime = Math.max(0, windowMs - (now - oldest));
        
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        // Update our notion of 'now' after waiting
        now = Date.now();
        requestTimestamps = requestTimestamps.filter(t => now - t < windowMs);
      }
      
      try {
        return await requestFn();
      } finally {
        requestTimestamps.push(Date.now());
      }
    });
    
    // Catch errors so the queue doesn't break for subsequent requests
    queue = next.catch(() => {}) as Promise<void>;
    
    return next;
  }

  return enqueueRequest;
}
