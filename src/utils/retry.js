/**
 * Retry with exponential backoff.
 * Retries on transient errors (network / 5xx). Throws on permanent failures.
 */
export async function withRetry(
  fn,
  { maxAttempts = 3, baseDelayMs = 500 } = {},
) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || attempt === maxAttempts) throw err;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function isTransient(err) {
  // Network errors
  if (
    err.code &&
    ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "ECONNREFUSED"].includes(err.code)
  ) {
    return true;
  }
  // HTTP 5xx or 429
  if (err.status && (err.status >= 500 || err.status === 429)) return true;
  return false;
}
