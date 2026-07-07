export function isQuotaOrRateLimitError(err: any): boolean {
  const msg = err?.message?.toLowerCase() || "";
  return (
    err?.status === 429 ||
    err?.status === 503 ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("high demand") ||
    msg.includes("unavailable") ||
    msg.includes("resource_exhausted")
  );
}
