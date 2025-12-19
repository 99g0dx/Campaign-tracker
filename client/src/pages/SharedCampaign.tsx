import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isPlaceholderPost, isScrapedPost, dedupePosts, filterPostsByWindow, computeTotals, canonicalStatus } from "@/lib/postUtils";
import { getComparator } from "@/lib/sortUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Lock,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Music,
  ExternalLink,
  Loader2,
  AlertCircle,
  Search,
  ArrowUpDown,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type SocialLink = {
  id: number;
  url: string;
  platform: string | null;
  creatorName: string | null;
  postStatus: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  status?: string | null;
  lastScrapedAt?: string | null;
  scrapedAt?: string | null;
  isScraped?: boolean | null;
};

type EngagementData = {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  totalEngagement: number;
};

type Campaign = {
  id: number;
  name: string;
  songTitle: string;
  songArtist: string | null;
  status: string;
  createdAt: string;
};

type EngagementWindow = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  label: string;
};

type SharedData = {
  campaign: Campaign;
  socialLinks: SocialLink[];
  engagementHistory: EngagementData[];
  engagementWindows?: Record<string, EngagementWindow>;
};

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

function getPlatformColor(platform: string): string {
  switch (platform.toLowerCase()) {
    case "tiktok":
      return "bg-black text-white dark:bg-white dark:text-black";
    case "instagram":
      return "bg-gradient-to-r from-purple-500 to-pink-500 text-white";
    case "youtube":
      return "bg-red-600 text-white";
    case "twitter":
      return "bg-sky-500 text-white";
    case "facebook":
      return "bg-blue-600 text-white";
    default:
      return "bg-muted";
  }
}

function getStatusBadge(status: string) {
  switch (status?.toLowerCase()) {
    case "active":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 no-default-hover-elevate no-default-active-elevate">Active</Badge>;
    case "done":
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 no-default-hover-elevate no-default-active-elevate">Done</Badge>;
    case "briefed":
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 no-default-hover-elevate no-default-active-elevate">Briefed</Badge>;
    case "pending":
    default:
      return <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">Pending</Badge>;
  }
}

export default function SharedCampaign() {
  const params = useParams();
  const slug = params.slug;

  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SharedData | null>(null);
  const [selectedTimeWindow, setSelectedTimeWindow] = useState("24h");
  const [visibleMetrics, setVisibleMetrics] = useState({
    views: true,
    likes: true,
    comments: true,
    shares: true,
  });

  // Dev convenience: allow overriding initial sort/window via URL params (e.g. ?sort=platform&window=24h)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const s = params.get("sort");
      const w = params.get("window");
      if (s) setSortBy(s);
      if (w) setSelectedTimeWindow(w);
    } catch (err) {
      // ignore in SSR or invalid URLs
    }
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  // Status multi-select filter (defaults to All)
  const ALL_STATUSES = ["Pending", "Briefed", "Active", "Done"] as const;
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set(ALL_STATUSES));
  const [sortBy, setSortBy] = useState<string>("views");

  const toggleMetric = (metric: keyof typeof visibleMetrics) => {
    setVisibleMetrics(prev => ({ ...prev, [metric]: !prev[metric] }));
  };

  useEffect(() => {
    if (!slug) return;

    async function tryFetch() {
      try {
        const res = await fetch(`/api/public/campaigns/${slug}`);
        if (res.ok) {
          const result = await res.json();
          setData(result);
          setUnlocked(true);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }

    tryFetch();
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !password.trim()) return;

    setVerifying(true);
    setError(null);

    try {
      const verifyRes = await fetch(`/api/public/campaigns/${slug}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!verifyRes.ok) {
        const errorData = await verifyRes.json();
        throw new Error(errorData.error || "Incorrect password");
      }

      const dataRes = await fetch(`/api/public/campaigns/${slug}`);
      if (!dataRes.ok) {
        throw new Error("Could not load campaign");
      }

      const result = await dataRes.json();
      setData(result);
      setUnlocked(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  }

  // Use the single canonical filteredPosts array across table, totals and charts
  const {
    filteredPosts,
    chartPosts,
    counts,
    campaignTotals,
    windowTotals,
    engagementHistoryLocal,
  } = useMemo(() => {
    if (!data?.socialLinks) {
      return {
        filteredPosts: [],
        chartPosts: [],
        counts: { totalPosts: 0, excludedPlaceholders: 0, excludedNotScraped: 0 },
        campaignTotals: { totalViews: 0, totalLikes: 0, totalComments: 0, totalShares: 0, totalEngagement: 0 },
        windowTotals: { totalViews: 0, totalLikes: 0, totalComments: 0, totalShares: 0, totalEngagement: 0 },
        engagementHistoryLocal: [],
      };
    }

    // 1) dedupe
    const deduped = dedupePosts(data.socialLinks as any);

    const totalPosts = deduped.length;
    const excludedPlaceholders = deduped.filter(isPlaceholderPost).length;
    const excludedNotScraped = deduped.filter((p: any) => !isPlaceholderPost(p) && !isScrapedPost(p)).length;

    // base included posts (campaign-level totals)
    const includedBase = deduped.filter((p: any) => !isPlaceholderPost(p) && isScrapedPost(p));

    // window-limited posts (for chart and window calculations)
    const windowLimited = filterPostsByWindow(includedBase, selectedTimeWindow);

    // filtered posts for the table and selected window totals (apply search/platform/status)
    const filtered = windowLimited.filter((link: any) => {
      const matchesSearch = !searchQuery || 
        (link.creatorName?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (link.url || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPlatform = platformFilter === "all" || 
        (link.platform ?? "").toLowerCase() === platformFilter.toLowerCase();

const matchesStatus = statusFilters.has(canonicalStatus(link.postStatus));

      return matchesSearch && matchesPlatform && matchesStatus;
    });

    // sort using shared comparator
    filtered.sort(getComparator(sortBy as any));

    const campaignTotals = computeTotals(includedBase);
    const windowTotals = computeTotals(filtered);

    // build daily series for the selected window; this is based on the windowLimited set (not further filtered by search/platform)
    const metrics = ["views", "likes", "comments", "shares"];
    // create a map date->object
    const dayMap = new Map<string, any>();
    const daysArr = (() => {
      const hours = { "24h":24, "72h":72, "7d":24*7, "30d":24*30, "60d":24*60, "90d":24*90 }[selectedTimeWindow] ?? 24;
      const dayCount = Math.ceil(hours / 24);
      const arr: number[] = [];
      const now = Date.now();
      for (let i = dayCount - 1; i >= 0; i--) {
        const d = new Date(now - i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
        arr.push(Date.parse(dayStart));
        dayMap.set(dayStart, { date: dayStart, views: 0, likes: 0, comments: 0, shares: 0, totalEngagement: 0 });
      }
      return arr;
    })();

    for (const p of windowLimited) {
      const dstr = (p.lastScrapedAt ?? p.scrapedAt);
      if (!dstr) continue;
      const ts = Date.parse(dstr);
      if (isNaN(ts)) continue;
      // find midnight UTC for that date
      const d = new Date(ts);
      const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
      if (!dayMap.has(dayStart)) continue;
      const entry = dayMap.get(dayStart);
      entry.views += p.views || 0;
      entry.likes += p.likes || 0;
      entry.comments += p.comments || 0;
      entry.shares += p.shares || 0;
      entry.totalEngagement = entry.likes + entry.comments + entry.shares;
      dayMap.set(dayStart, entry);
    }

    const engagementHistoryLocal = Array.from(dayMap.values());

    return {
      filteredPosts: filtered,
      chartPosts: windowLimited,
      counts: { totalPosts, excludedPlaceholders, excludedNotScraped },
      campaignTotals,
      windowTotals,
      engagementHistoryLocal,
    };
  }, [data?.socialLinks, searchQuery, platformFilter, statusFilters, sortBy, selectedTimeWindow]);

  const uniquePlatforms = useMemo(() => {
    if (!data?.socialLinks) return [];
    return Array.from(new Set(data.socialLinks.map(l => l.platform)));
  }, [data?.socialLinks]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!unlocked || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
              <Lock className="h-6 w-6" />
            </div>
            <CardTitle>Password Required</CardTitle>
            <CardDescription>
              This campaign is password protected. Enter the password to view it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="input-share-password"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={verifying || !password.trim()}
                data-testid="button-unlock"
              >
                {verifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {verifying ? "Verifying..." : "Unlock"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { campaign, socialLinks, engagementHistory, engagementWindows } = data;

  // Use campaignTotals (computed from deduped, non-placeholder, scraped posts)
  // campaign totals and window totals are computed in the memo above and accessed directly (campaignTotals, windowTotals)



  const timeWindowKeys = ["24h", "72h", "7d", "30d", "60d", "90d"];
  const selectedWindowData = engagementWindows?.[selectedTimeWindow];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-campaign-name">
                    {campaign.name}
                  </h1>
                  <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate shrink-0">
                    View Only
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Music className="h-4 w-4 shrink-0" />
                  <span className="text-sm md:text-base">
                    {campaign.songTitle}
                    {campaign.songArtist && <span className="font-medium"> by {campaign.songArtist}</span>}
                  </span>
                </div>
              </div>
              <Badge 
                variant={campaign.status === "Active" ? "default" : "secondary"}
                className="shrink-0 no-default-hover-elevate no-default-active-elevate"
              >
                {campaign.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-2xl md:text-3xl font-bold tabular-nums" data-testid="text-total-views">
                  {formatNumber(campaignTotals.totalViews)}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground font-medium">Total Views</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                  <Heart className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <p className="text-2xl md:text-3xl font-bold tabular-nums" data-testid="text-total-likes">
                  {formatNumber(campaignTotals.totalLikes)}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground font-medium">Total Likes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                  <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-2xl md:text-3xl font-bold tabular-nums" data-testid="text-total-comments">
                  {formatNumber(campaignTotals.totalComments)}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground font-medium">Comments</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <Share2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-2xl md:text-3xl font-bold tabular-nums" data-testid="text-total-shares">
                  {formatNumber(campaignTotals.totalShares)}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground font-medium">Shares</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {data && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Engagement Breakdown by Time Period</CardTitle>
              <CardDescription>Compare engagement metrics across different time windows</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {timeWindowKeys.map((key) => (
                  <Button
                    key={key}
                    variant={selectedTimeWindow === key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTimeWindow(key)}
                    data-testid={`button-time-window-${key}`}
                  >
                    {engagementWindows?.[key]?.label || key}
                  </Button>
                ))}
              </div>
              
              {true && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground font-medium">
                    Selected window totals ({engagementWindows?.[selectedTimeWindow]?.label || selectedTimeWindow})
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
                      <div className="flex items-center gap-2 mb-1">
                        <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Views</span>
                      </div>
                      <p className="text-xl font-bold tabular-nums" data-testid="text-window-views">
                        {formatNumber(windowTotals.totalViews)}
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-100 dark:border-yellow-900">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Total Engagement</span>
                      </div>
                      <p className="text-xl font-bold tabular-nums" data-testid="text-window-engagement">
                        {formatNumber(windowTotals.totalEngagement)}
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900">
                      <div className="flex items-center gap-2 mb-1">
                        <Heart className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span className="text-sm font-medium text-red-700 dark:text-red-300">Likes</span>
                      </div>
                      <p className="text-xl font-bold tabular-nums" data-testid="text-window-likes">
                        {formatNumber(windowTotals.totalLikes)}
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">Comments</span>
                      </div>
                      <p className="text-xl font-bold tabular-nums" data-testid="text-window-comments">
                        {formatNumber(windowTotals.totalComments)}
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900">
                      <div className="flex items-center gap-2 mb-1">
                        <Share2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Shares</span>
                      </div>
                      <p className="text-xl font-bold tabular-nums" data-testid="text-window-shares">
                        {formatNumber(windowTotals.totalShares)}
                      </p>
                    </div>
                  </div>

                  {import.meta.env.DEV && (
                    <div className="text-xs text-muted-foreground mt-2">
                      <div>Posts counted: <strong>{filteredPosts.length}</strong> / Total posts: <strong>{counts.totalPosts}</strong></div>
                      <div>Excluded placeholders: <strong>{counts.excludedPlaceholders}</strong></div>
                      <div>Excluded not-scraped: <strong>{counts.excludedNotScraped}</strong></div>
                    </div>
                  )}

                </div>
              )}
            </CardContent>
          </Card>
        )}

        {engagementHistory.length > 0 && (
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4">
              <div>
                <CardTitle className="text-lg">Engagement Over Time</CardTitle>
                <CardDescription>Track how engagement metrics change over time</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="views-toggle-shared" 
                    checked={visibleMetrics.views}
                    onCheckedChange={() => toggleMetric("views")}
                    data-testid="checkbox-views-shared"
                  />
                  <Label htmlFor="views-toggle-shared" className="text-sm cursor-pointer flex items-center gap-1">
                    <Eye className="h-3 w-3 text-blue-500" /> Views
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="likes-toggle-shared" 
                    checked={visibleMetrics.likes}
                    onCheckedChange={() => toggleMetric("likes")}
                    data-testid="checkbox-likes-shared"
                  />
                  <Label htmlFor="likes-toggle-shared" className="text-sm cursor-pointer flex items-center gap-1">
                    <Heart className="h-3 w-3 text-red-500" /> Likes
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="comments-toggle-shared" 
                    checked={visibleMetrics.comments}
                    onCheckedChange={() => toggleMetric("comments")}
                    data-testid="checkbox-comments-shared"
                  />
                  <Label htmlFor="comments-toggle-shared" className="text-sm cursor-pointer flex items-center gap-1">
                    <MessageCircle className="h-3 w-3 text-green-500" /> Comments
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="shares-toggle-shared" 
                    checked={visibleMetrics.shares}
                    onCheckedChange={() => toggleMetric("shares")}
                    data-testid="checkbox-shares-shared"
                  />
                  <Label htmlFor="shares-toggle-shared" className="text-sm cursor-pointer flex items-center gap-1">
                    <Share2 className="h-3 w-3 text-purple-500" /> Shares
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={engagementHistoryLocal}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        });
                      }}
                      className="text-xs"
                    />
                    <YAxis className="text-xs" tickFormatter={formatNumber} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      labelFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString();
                      }}
                      formatter={(value: number) => [formatNumber(value), ""]}
                    />
                    <Legend />
                    {visibleMetrics.views && (
                      <Line
                        type="monotone"
                        dataKey="views"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        name="Views"
                      />
                    )}
                    {visibleMetrics.likes && (
                      <Line
                        type="monotone"
                        dataKey="likes"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                        name="Likes"
                      />
                    )}
                    {visibleMetrics.comments && (
                      <Line
                        type="monotone"
                        dataKey="comments"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={false}
                        name="Comments"
                      />
                    )}
                    {visibleMetrics.shares && (
                      <Line
                        type="monotone"
                        dataKey="shares"
                        stroke="#a855f7"
                        strokeWidth={2}
                        dot={false}
                        name="Shares"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Posts ({filteredPosts.length})</CardTitle>
                <CardDescription>All creators and their posts in this campaign</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search creator or link..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-posts"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger className="w-[130px]" data-testid="select-platform-filter">
                    <SelectValue placeholder="Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Platforms</SelectItem>
                    {uniquePlatforms.map((platform) => (
                      <SelectItem key={platform} value={platform || 'unknown'}>
                        {platform || 'Unknown'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[140px]" data-testid="button-status-filter">
                      {(() => {
                        if (statusFilters.size === ALL_STATUSES.length || statusFilters.size === 0) return "Status: All";
                        if (statusFilters.size === 1) return `Status: ${Array.from(statusFilters)[0]}`;
                        return `Status: ${statusFilters.size} selected`;
                      })()}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48">
                    <div className="flex justify-between">
                      <Button variant="ghost" size="sm" onClick={() => setStatusFilters(new Set(ALL_STATUSES))}>All</Button>
                      <Button variant="ghost" size="sm" onClick={() => setStatusFilters(new Set(ALL_STATUSES))}>Clear</Button>
                    </div>
                    <div className="mt-2 space-y-2">
                      {ALL_STATUSES.map((s) => (
                        <label key={s} className="flex items-center gap-2">
                          <Checkbox checked={statusFilters.has(s)} onCheckedChange={() => {
                            setStatusFilters(prev => {
                              const next = new Set(prev);
                              if (next.has(s)) next.delete(s);
                              else next.add(s);
                              if (next.size === 0) return new Set(ALL_STATUSES);
                              return next;
                            });
                          }} />
                          <span>{s}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[140px]" data-testid="select-sort-by">
                    <ArrowUpDown className="h-4 w-4 mr-1" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="views">Views (High)</SelectItem>
                    <SelectItem value="likes">Likes (High)</SelectItem>
                    <SelectItem value="comments">Comments (High)</SelectItem>
                    <SelectItem value="shares">Shares (High)</SelectItem>
                    <SelectItem value="platform">Platform (A-Z)</SelectItem>
                    <SelectItem value="status">Status (A-Z)</SelectItem>
                    <SelectItem value="creator">Creator (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filteredPosts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {socialLinks.length === 0 
                  ? "No posts in this campaign yet."
                  : "No posts match your search criteria."}
              </div>
            ) : (
              <>
                <div className="hidden md:block border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[100px]">Platform</TableHead>
                        <TableHead className="w-[90px]">Status</TableHead>
                        <TableHead>Creator</TableHead>
                        <TableHead>Post Link</TableHead>
                        <TableHead className="text-right w-[90px]">Views</TableHead>
                        <TableHead className="text-right w-[80px]">Likes</TableHead>
                        <TableHead className="text-right w-[90px]">Comments</TableHead>
                        <TableHead className="text-right w-[80px]">Shares</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPosts.map((link) => (
                        <TableRow 
                          key={link.id} 
                          className="hover-elevate"
                          data-testid={`shared-link-${link.id}`}
                        >
                          <TableCell>
                            <Badge className={`${getPlatformColor(link.platform || 'unknown')} no-default-hover-elevate no-default-active-elevate`}>
                              {link.platform || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(link.postStatus || 'pending')}
                          </TableCell>
                          <TableCell className="font-medium">
                            {link.creatorName || <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 max-w-[200px]"
                            >
                              <span className="truncate">{link.url}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatNumber(link.views)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatNumber(link.likes)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatNumber(link.comments)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {(link.shares ?? 0) > 0 ? formatNumber(link.shares ?? 0) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="md:hidden space-y-3">
                  {filteredPosts.map((link) => (
                    <Card key={link.id} className="hover-elevate" data-testid={`shared-link-mobile-${link.id}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Badge className={`${getPlatformColor(link.platform || 'unknown')} no-default-hover-elevate no-default-active-elevate`}>
                              {link.platform || 'Unknown'}
                            </Badge>
                            {getStatusBadge(link.postStatus || 'pending')}
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Creator</p>
                          <p className="font-medium text-sm">
                            {link.creatorName || <span className="text-muted-foreground">—</span>}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Post Link</p>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <span className="truncate">{link.url}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        </div>

                        <div className="grid grid-cols-4 gap-2 pt-2 border-t">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Views</p>
                            <p className="font-bold tabular-nums">{formatNumber(link.views)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Likes</p>
                            <p className="font-bold tabular-nums">{formatNumber(link.likes)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Comments</p>
                            <p className="font-bold tabular-nums">{formatNumber(link.comments)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Shares</p>
                            <p className="font-bold tabular-nums">{(link.shares ?? 0) > 0 ? formatNumber(link.shares ?? 0) : "—"}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
