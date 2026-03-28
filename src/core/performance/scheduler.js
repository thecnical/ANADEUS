export async function runWithConcurrency(items, worker, options = {}) {
  const concurrency = Math.max(1, options.concurrency || 3);
  const prioritizedItems = options.prioritize
    ? [...items].sort((left, right) => options.prioritize(right) - options.prioritize(left))
    : [...items];
  const results = new Array(prioritizedItems.length);
  let cursor = 0;

  async function runNext() {
    const index = cursor;
    if (index >= prioritizedItems.length) {
      return;
    }

    cursor += 1;
    results[index] = await worker(prioritizedItems[index], index);
    await runNext();
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, prioritizedItems.length) }, () => runNext()),
  );

  return results;
}

export function prioritizeTarget(target) {
  const value = String(target || "").toLowerCase();
  let score = 0;

  if (value.includes("admin") || value.includes("dashboard")) {
    score += 3;
  }

  if (value.includes("login") || value.includes("auth") || value.includes("signin")) {
    score += 3;
  }

  if (value.includes("/api") || value.includes("graphql")) {
    score += 2;
  }

  return score;
}
