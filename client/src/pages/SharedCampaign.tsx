import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  platform: string;
  creatorName: string | null;
  postStatus: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  status: string;
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
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>;
    case "done":
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Done</Badge>;
    case "briefed":
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Briefed</Badge>;
    case "pending":
    default:
      return <Badge variant="secondary">Pending</Badge>;
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

  const totalViews = socialLinks.reduce((sum, l) => sum + (l.views || 0), 0);
  const totalLikes = socialLinks.reduce((sum, l) => sum + (l.likes || 0), 0);
  const totalComments = socialLinks.reduce((sum, l) => sum + (l.comments || 0), 0);
  const totalShares = socialLinks.reduce((sum, l) => sum + (l.shares || 0), 0);

  const timeWindowKeys = ["24h", "72h", "7d", "30d", "60d", "90d"];
  const selectedWindowData = engagementWindows?.[selectedTimeWindow];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="text-center mb-8">
          <Badge variant="outline" className="mb-2">
            Shared Campaign - View Only
          </Badge>
          <h1 className="text-3xl font-bold" data-testid="text-campaign-name">
            {campaign.name}
          </h1>
          <p className="text-muted-foreground flex items-center justify-center gap-2 mt-2">
            <Music className="h-4 w-4" />
            {campaign.songTitle}
            {campaign.songArtist && ` by ${campaign.songArtist}`}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Eye className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold" data-testid="text-total-views">
                  {formatNumber(totalViews)}
                </p>
                <p className="text-sm text-muted-foreground">Total Views</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Heart className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold" data-testid="text-total-likes">
                  {formatNumber(totalLikes)}
                </p>
                <p className="text-sm text-muted-foreground">Total Likes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <MessageCircle className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold" data-testid="text-total-comments">
                  {formatNumber(totalComments)}
                </p>
                <p className="text-sm text-muted-foreground">Comments</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Share2 className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold" data-testid="text-total-shares">
                  {formatNumber(totalShares)}
                </p>
                <p className="text-sm text-muted-foreground">Shares</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {engagementWindows && (
          <Card>
            <CardHeader>
              <CardTitle>Engagement Breakdown by Time Period</CardTitle>
              <CardDescription>View engagement metrics across different time windows</CardDescription>
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
                    {engagementWindows[key]?.label || key}
                  </Button>
                ))}
              </div>
              
              {selectedWindowData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Eye className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-muted-foreground">Views</span>
                    </div>
                    <p className="text-xl font-bold" data-testid="text-window-views">
                      {formatNumber(selectedWindowData.views)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Heart className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-muted-foreground">Likes</span>
                    </div>
                    <p className="text-xl font-bold" data-testid="text-window-likes">
                      {formatNumber(selectedWindowData.likes)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">Comments</span>
                    </div>
                    <p className="text-xl font-bold" data-testid="text-window-comments">
                      {formatNumber(selectedWindowData.comments)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Share2 className="h-4 w-4 text-purple-500" />
                      <span className="text-sm text-muted-foreground">Shares</span>
                    </div>
                    <p className="text-xl font-bold" data-testid="text-window-shares">
                      {formatNumber(selectedWindowData.shares)}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {engagementHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Engagement Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={engagementHistory}>
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
                    <Line
                      type="monotone"
                      dataKey="views"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      name="Views"
                    />
                    <Line
                      type="monotone"
                      dataKey="likes"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                      name="Likes"
                    />
                    <Line
                      type="monotone"
                      dataKey="comments"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                      name="Comments"
                    />
                    <Line
                      type="monotone"
                      dataKey="shares"
                      stroke="#a855f7"
                      strokeWidth={2}
                      dot={false}
                      name="Shares"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Posts ({socialLinks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {socialLinks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No posts in this campaign yet.
              </p>
            ) : (
              <div className="space-y-3">
                {socialLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`shared-link-${link.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 flex-wrap">
                      <Badge className={getPlatformColor(link.platform)}>
                        {link.platform}
                      </Badge>
                      {getStatusBadge(link.postStatus)}
                      {link.creatorName && (
                        <span className="text-sm font-medium">{link.creatorName}</span>
                      )}
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-foreground truncate flex items-center gap-1"
                      >
                        <span className="truncate max-w-[200px]">{link.url}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {formatNumber(link.views)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {formatNumber(link.likes)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {formatNumber(link.comments)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
