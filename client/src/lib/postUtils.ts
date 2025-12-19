export type Post = Record<string, any> & {
  id?: number | string;
  url?: string;
  postLink?: string;
  platform?: string | null;
  postStatus?: string | null;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  lastScrapedAt?: string | null;
  scrapedAt?: string | null;
  isScraped?: boolean | null;
};

export function isPlaceholderPost(post: Post): boolean {
  const url = post.url ?? post.postLink ?? "";
  if (typeof url === "string" && url.startsWith("placeholder://")) return true;

  if (!post.platform) return true;

  const status = (post.postStatus || post.status || "").toString().toLowerCase();
  const metricsSum = (post.views || 0) + (post.likes || 0) + (post.comments || 0) + (post.shares || 0);

  if (status === "pending" && metricsSum === 0) return true;

  return false;
}

export function isScrapedPost(post: Post): boolean {
  if (post.isScraped === true) return true;
  if (post.lastScrapedAt || post.scrapedAt) {
    try {
      const ts = Date.parse(post.lastScrapedAt || post.scrapedAt!);
      return !isNaN(ts);
    } catch {
      return false;
    }
  }
  return false;
}

export function canonicalStatus(s: any): string {
  const norm = (s: any) => (s ?? "").toString().trim().toLowerCase();
  const v = norm(s);
  if (v === "pending") return "Pending";
  if (v === "briefed") return "Briefed";
  if (v === "active") return "Active";
  if (v === "done") return "Done";
  return "Pending";
}

export function dedupePosts(posts: Post[]): Post[] {
  const seen = new Map<string, Post>();
  for (const p of posts) {
    // prefer postId or postKey or url/postLink as dedupe key; fallback to id
    const key = (p.postId ?? p.postKey ?? p.url ?? p.postLink ?? p.id ?? `${p.platform ?? ""}:${p.creatorName ?? ""}`).toString();
    if (!seen.has(key)) seen.set(key, p);
  }
  return Array.from(seen.values());
}

const WINDOW_HOURS: Record<string, number> = {
  "24h": 24,
  "72h": 72,
  "7d": 24 * 7,
  "30d": 24 * 30,
  "60d": 24 * 60,
  "90d": 24 * 90,
};

export function filterPostsByWindow(posts: Post[], windowKey: string): Post[] {
  const hours = WINDOW_HOURS[windowKey] ?? 24;
  const cutoff = Date.now() - hours * 60 * 60 * 1000;

  return posts.filter((p) => {
    const dateStr = p.lastScrapedAt ?? p.scrapedAt;
    if (!dateStr) return false;
    const ts = Date.parse(dateStr);
    if (isNaN(ts)) return false;
    return ts >= cutoff;
  });
}

export function computeTotals(posts: Post[]) {
  const totals = posts.reduce(
    (acc: { views: number; likes: number; comments: number; shares: number }, p) => {
      acc.views += p.views || 0;
      acc.likes += p.likes || 0;
      acc.comments += p.comments || 0;
      acc.shares += p.shares || 0;
      return acc;
    },
    { views: 0, likes: 0, comments: 0, shares: 0 },
  );

  return {
    totalViews: totals.views,
    totalLikes: totals.likes,
    totalComments: totals.comments,
    totalShares: totals.shares,
    totalEngagement: totals.likes + totals.comments + totals.shares,
  };
}

function startOfDayUTC(ts: number) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function groupByDay(posts: Post[], metricKey: string, windowKey?: string) {
  // Determine the range (number of days) using windowKey if provided
  const days = Math.ceil((WINDOW_HOURS[windowKey ?? "90d"] ?? 24) / 24);
  const now = Date.now();
  const dayMap = new Map<number, number>();

  // initialize days map with 0s
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = startOfDayUTC(now - i * 24 * 60 * 60 * 1000);
    dayMap.set(dayStart, 0);
  }

  for (const p of posts) {
    const dateStr = p.lastScrapedAt ?? p.scrapedAt;
    if (!dateStr) continue;
    const ts = Date.parse(dateStr);
    if (isNaN(ts)) continue;
    const dayStart = startOfDayUTC(ts);
    if (!dayMap.has(dayStart)) {
      // ignore points outside the desired window
      continue;
    }
    const value = p[metricKey] ?? 0;
    dayMap.set(dayStart, (dayMap.get(dayStart) || 0) + (value as number));
  }

  // return sorted array
  const result = Array.from(dayMap.entries()).map(([dayStart, val]) => ({
    date: new Date(dayStart).toISOString(),
    value: val,
  }));

  return result;
}
