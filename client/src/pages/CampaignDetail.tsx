import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Plus,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Music,
  RefreshCw,
  ExternalLink,
  Loader2,
  User,
  Link as LinkIcon,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Pencil,
  Download,
  Lock,
  Upload,
  Trash2,
} from "lucide-react";
import ShareCampaignModal from "@/components/ShareCampaignModal";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useCampaigns,
  useSocialLinks,
  useAddSocialLink,
  useRescrapeSocialLink,
  useRescrapeAllCampaignLinks,
  useUpdateSocialLink,
  useDeleteSocialLink,
  useUpdateCampaignStatus,
  useCampaignEngagementHistory,
  type SocialLink,
  type PostStatus,
} from "@/hooks/useCampaigns";
import { useToast } from "@/hooks/use-toast";
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

const POST_STATUS_OPTIONS: { value: PostStatus; label: string; color: string }[] = [
  { value: "pending", label: "Pending", color: "bg-muted text-muted-foreground" },
  { value: "briefed", label: "Briefed", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "active", label: "Active", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "done", label: "Done", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
];

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

type CreatorNameOption = {
  creatorName: string;
  platform: string;
};

function CreatorNameAutocomplete({
  value,
  onChange,
  placeholder = "Search or type creator name",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [options, setOptions] = useState<CreatorNameOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      if (!value || value.length < 2) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/social-links/creator-names/search?q=${encodeURIComponent(value)}`,
          { signal: controller.signal, credentials: "include" }
        );
        const data = await res.json();
        setOptions(data.results || []);
        setOpen(true);
      } catch {
      } finally {
        setLoading(false);
      }
    };
    const t = setTimeout(run, 200);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [value]);

  function handleSelect(opt: CreatorNameOption) {
    onChange(opt.creatorName);
    setOpen(false);
  }

  return (
    <div className="relative">
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => options.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        data-testid="input-creator-name"
        required
      />
      {open && options.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md bg-popover border border-border max-h-56 overflow-y-auto shadow-md">
          {options.map((opt, idx) => (
            <button
              key={`${opt.creatorName}-${idx}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(opt)}
              className="w-full text-left px-3 py-2 hover-elevate text-sm"
              data-testid={`option-creator-${idx}`}
            >
              <div className="font-medium">{opt.creatorName}</div>
              <div className="text-xs text-muted-foreground">{opt.platform}</div>
            </button>
          ))}
        </div>
      )}
      {loading && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          ...
        </div>
      )}
    </div>
  );
}

function AddCreatorModal({
  open,
  onOpenChange,
  campaignId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
}) {
  const [creatorName, setCreatorName] = useState("");
  const [url, setUrl] = useState("");
  const [postStatus, setPostStatus] = useState<PostStatus>("pending");
  const { mutate: addLink, isPending } = useAddSocialLink();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorName.trim()) return;

    addLink(
      {
        url: url.trim() || `placeholder://${creatorName.trim().replace(/[^a-zA-Z0-9]/g, "")}`,
        campaignId,
        creatorName: creatorName.trim(),
        postStatus,
      },
      {
        onSuccess: () => {
          setCreatorName("");
          setUrl("");
          setPostStatus("pending");
          onOpenChange(false);
          toast({ title: "Creator added", description: url ? "Scraping engagement data..." : "Link pending" });
        },
        onError: (error: Error) => {
          toast({
            title: "Failed to add creator",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="modal-add-creator">
        <DialogHeader>
          <DialogTitle>Add Creator</DialogTitle>
          <DialogDescription>
            Add a creator to track. You can search for existing creators or type a new name.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="creatorName">Creator Name / Handle</Label>
            <CreatorNameAutocomplete
              value={creatorName}
              onChange={setCreatorName}
              placeholder="Search or type @creator_handle"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">Post URL (optional - add when available)</Label>
            <Input
              id="url"
              placeholder="https://www.tiktok.com/@user/video/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-testid="input-link-url"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={postStatus} onValueChange={(v) => setPostStatus(v as PostStatus)}>
              <SelectTrigger data-testid="select-creator-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POST_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !creatorName.trim()}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                "Add Creator"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditLinkModal({
  open,
  onOpenChange,
  link,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: SocialLink | null;
}) {
  const [url, setUrl] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [views, setViews] = useState("");
  const [likes, setLikes] = useState("");
  const [comments, setComments] = useState("");
  const [shares, setShares] = useState("");
  const { mutate: updateLink, isPending } = useUpdateSocialLink();
  const { toast } = useToast();

  const isPlaceholder = link?.url.startsWith("placeholder://");

  // Reset form when modal opens or link changes
  useEffect(() => {
    if (open && link) {
      setUrl(link.url.startsWith("placeholder://") ? "" : link.url);
      setCreatorName(link.creatorName || "");
      setViews(link.views?.toString() || "0");
      setLikes(link.likes?.toString() || "0");
      setComments(link.comments?.toString() || "0");
      setShares(link.shares?.toString() || "0");
    }
  }, [open, link?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!link) return;

    updateLink(
      {
        id: link.id,
        url: url.trim() || undefined,
        creatorName: creatorName.trim() || undefined,
        views: parseInt(views) || 0,
        likes: parseInt(likes) || 0,
        comments: parseInt(comments) || 0,
        shares: parseInt(shares) || 0,
      },
      {
        onSuccess: () => {
          setUrl("");
          setCreatorName("");
          setViews("");
          setLikes("");
          setComments("");
          setShares("");
          onOpenChange(false);
          toast({ title: "Updated", description: "Creator updated successfully" });
        },
        onError: (error: Error) => {
          toast({
            title: "Failed to update",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setUrl("");
      setCreatorName("");
      setViews("");
      setLikes("");
      setComments("");
      setShares("");
    }
    onOpenChange(newOpen);
  };

  if (!link) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent data-testid="modal-edit-link" className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Creator</DialogTitle>
          <DialogDescription>
            {isPlaceholder ? "Add post details for this creator" : "Update creator and engagement data"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="creatorName">Creator Name</Label>
            <Input
              id="creatorName"
              placeholder="@creator_handle"
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              data-testid="input-edit-creator-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">Post URL</Label>
            <Input
              id="url"
              placeholder="https://www.tiktok.com/@user/video/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-testid="input-edit-url"
            />
          </div>
          
          <div className="border-t pt-4">
            <Label className="text-sm text-muted-foreground mb-3 block">Engagement Metrics (manual entry)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="views" className="text-xs">Views</Label>
                <Input
                  id="views"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={views}
                  onChange={(e) => setViews(e.target.value)}
                  data-testid="input-edit-views"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="likes" className="text-xs">Likes</Label>
                <Input
                  id="likes"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={likes}
                  onChange={(e) => setLikes(e.target.value)}
                  data-testid="input-edit-likes"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="comments" className="text-xs">Comments</Label>
                <Input
                  id="comments"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  data-testid="input-edit-comments"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="shares" className="text-xs">Shares</Label>
                <Input
                  id="shares"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  data-testid="input-edit-shares"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type TimeRange = "24h" | "3d" | "7d" | "30d" | "60d" | "90d";

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string; days: number }[] = [
  { value: "24h", label: "24hrs", days: 1 },
  { value: "3d", label: "3 days", days: 3 },
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "60d", label: "60 days", days: 60 },
  { value: "90d", label: "90 days", days: 90 },
];

type MetricVisibility = {
  views: boolean;
  likes: boolean;
  comments: boolean;
  shares: boolean;
};

export default function CampaignDetail() {
  const [, params] = useRoute("/campaign/:id");
  const campaignId = params?.id ? parseInt(params.id, 10) : null;

  const [addCreatorOpen, setAddCreatorOpen] = useState(false);
  const [editLink, setEditLink] = useState<SocialLink | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [importing, setImporting] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<SocialLink | null>(null);
  const [visibleMetrics, setVisibleMetrics] = useState<MetricVisibility>({
    views: true,
    likes: true,
    comments: true,
    shares: true,
  });

  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns();
  const { data: socialLinks, isLoading: linksLoading } = useSocialLinks();
  const { data: engagementHistory, isLoading: historyLoading } = useCampaignEngagementHistory(campaignId || 0);
  const { mutate: updateLink } = useUpdateSocialLink();
  const { mutate: deleteLink, isPending: isDeleting } = useDeleteSocialLink();
  const { mutate: rescrape, isPending: isRescraping } = useRescrapeSocialLink();
  const { mutate: rescrapeAll, isPending: isScrapingAll } = useRescrapeAllCampaignLinks();
  const { mutate: updateCampaignStatus } = useUpdateCampaignStatus();
  const { toast } = useToast();

  const campaign = campaigns?.find((c) => c.id === campaignId);
  const campaignLinks = socialLinks?.filter((l) => l.campaignId === campaignId) || [];

  const selectedRangeOption = TIME_RANGE_OPTIONS.find((o) => o.value === timeRange) || TIME_RANGE_OPTIONS[2];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - selectedRangeOption.days);

  const chartData = engagementHistory
    ?.filter((point) => new Date(point.date) >= cutoffDate)
    .map((point) => ({
      ...point,
      date: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    })) || [];

  const hasChartData = chartData.length > 0;
  
  const getEngagementTrend = () => {
    if (chartData.length < 2) return null;
    const last = chartData[chartData.length - 1];
    const prev = chartData[chartData.length - 2];
    const diff = last.totalEngagement - prev.totalEngagement;
    const pct = prev.totalEngagement > 0 ? ((diff / prev.totalEngagement) * 100).toFixed(1) : "0";
    return { diff, pct, isUp: diff >= 0 };
  };
  
  const trend = getEngagementTrend();

  const toggleMetric = (metric: keyof MetricVisibility) => {
    setVisibleMetrics(prev => ({ ...prev, [metric]: !prev[metric] }));
  };

  const handleScrapeAll = () => {
    if (!campaignId) return;
    rescrapeAll(campaignId, {
      onSuccess: (data: any) => {
        toast({ 
          title: "Scraping started", 
          description: `Scraping ${data.scraped} posts...` 
        });
      },
      onError: (error: Error) => {
        toast({
          title: "Failed to scrape",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  const downloadCSV = () => {
    if (!campaign || campaignLinks.length === 0) return;

    const headers = ["Creator", "Platform", "URL", "Status", "Views", "Likes", "Comments", "Shares", "Last Scraped"];
    const rows = campaignLinks.map(link => [
      link.creatorName || "Unknown",
      link.url.startsWith("placeholder://") ? "N/A" : link.platform,
      link.url.startsWith("placeholder://") ? "" : link.url,
      link.postStatus,
      link.views ?? 0,
      link.likes ?? 0,
      link.comments ?? 0,
      link.shares ?? 0,
      link.lastScrapedAt ? new Date(link.lastScrapedAt).toLocaleString() : "Never",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => 
        typeof cell === "string" && (cell.includes(",") || cell.includes('"')) 
          ? `"${cell.replace(/"/g, '""')}"` 
          : cell
      ).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${campaign.name.replace(/[^a-z0-9]/gi, "_")}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !campaignId) return;

    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/import-posts`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      toast({
        title: "Import successful",
        description: `Imported ${data.inserted} posts`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/social-links"] });
    } catch (err: any) {
      toast({
        title: "Import failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const handleStatusChange = (linkId: number, newStatus: PostStatus) => {
    updateLink({ id: linkId, postStatus: newStatus });
  };

  const handleDeleteCreator = () => {
    if (!linkToDelete) return;
    deleteLink(linkToDelete.id, {
      onSuccess: () => {
        toast({
          title: "Creator removed",
          description: `${linkToDelete.creatorName || "Creator"} has been removed from this campaign`,
        });
        setLinkToDelete(null);
      },
      onError: (error: Error) => {
        toast({
          title: "Failed to remove creator",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  if (campaignsLoading || linksLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-6xl p-4 md:p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-6xl p-4 md:p-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Music className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Campaign not found</h3>
              <p className="text-muted-foreground mb-4">
                This campaign doesn't exist or has been deleted
              </p>
              <Link href="/">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl p-4 md:p-6 space-y-6">
        <header className="space-y-4">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold" data-testid="text-campaign-name">{campaign.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Music className="h-4 w-4" />
                <span>{campaign.songTitle}</span>
                {campaign.songArtist && (
                  <span className="text-muted-foreground/60">by {campaign.songArtist}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShareModalOpen(true)}
                data-testid="button-share-campaign"
              >
                <Lock className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Select
                value={campaign.status}
                onValueChange={(value) => updateCampaignStatus({ id: campaign.id, status: value })}
              >
                <SelectTrigger 
                  className={`w-[120px] ${campaign.status === "Active" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-muted text-muted-foreground"}`}
                  data-testid="select-campaign-status"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <Eye className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Views</p>
                  <p className="text-2xl font-bold" data-testid="text-campaign-views">
                    {formatNumber(campaign.totalViews)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <Heart className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Likes</p>
                  <p className="text-2xl font-bold" data-testid="text-campaign-likes">
                    {formatNumber(campaign.totalLikes)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Comments</p>
                  <p className="text-2xl font-bold" data-testid="text-campaign-comments">
                    {formatNumber(campaign.totalComments)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <Share2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Shares</p>
                  <p className="text-2xl font-bold" data-testid="text-campaign-shares">
                    {formatNumber(campaign.totalShares)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Creators</p>
                  <p className="text-2xl font-bold" data-testid="text-campaign-creators">
                    {campaignLinks.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-engagement-chart">
          <CardHeader className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>Engagement Trends</CardTitle>
                {trend && (
                  <Badge variant={trend.isUp ? "default" : "destructive"} className="text-xs">
                    {trend.isUp ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {trend.isUp ? "+" : ""}{trend.pct}%
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {TIME_RANGE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    size="sm"
                    variant={timeRange === option.value ? "default" : "outline"}
                    onClick={() => setTimeRange(option.value)}
                    data-testid={`button-range-${option.value}`}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t">
              <span className="text-sm text-muted-foreground">Show:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={visibleMetrics.views} 
                  onCheckedChange={() => toggleMetric("views")}
                  data-testid="checkbox-toggle-views"
                />
                <span className="text-sm flex items-center gap-1">
                  <Eye className="h-3 w-3" style={{ color: 'hsl(var(--primary))' }} />
                  Views
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={visibleMetrics.likes} 
                  onCheckedChange={() => toggleMetric("likes")}
                  data-testid="checkbox-toggle-likes"
                />
                <span className="text-sm flex items-center gap-1">
                  <Heart className="h-3 w-3" style={{ color: '#f43f5e' }} />
                  Likes
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={visibleMetrics.comments} 
                  onCheckedChange={() => toggleMetric("comments")}
                  data-testid="checkbox-toggle-comments"
                />
                <span className="text-sm flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" style={{ color: '#8b5cf6' }} />
                  Comments
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={visibleMetrics.shares} 
                  onCheckedChange={() => toggleMetric("shares")}
                  data-testid="checkbox-toggle-shares"
                />
                <span className="text-sm flex items-center gap-1">
                  <Share2 className="h-3 w-3" style={{ color: '#22c55e' }} />
                  Shares
                </span>
              </label>
            </div>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : hasChartData ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs fill-muted-foreground"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs fill-muted-foreground"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => formatNumber(value)}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [formatNumber(value), '']}
                  />
                  <Legend />
                  {visibleMetrics.views && (
                    <Line 
                      type="monotone" 
                      dataKey="views" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 3 }}
                      activeDot={{ r: 5 }}
                      name="Views"
                    />
                  )}
                  {visibleMetrics.likes && (
                    <Line 
                      type="monotone" 
                      dataKey="likes" 
                      stroke="#f43f5e" 
                      strokeWidth={2}
                      dot={{ fill: '#f43f5e', strokeWidth: 0, r: 3 }}
                      activeDot={{ r: 5 }}
                      name="Likes"
                    />
                  )}
                  {visibleMetrics.comments && (
                    <Line 
                      type="monotone" 
                      dataKey="comments" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6', strokeWidth: 0, r: 3 }}
                      activeDot={{ r: 5 }}
                      name="Comments"
                    />
                  )}
                  {visibleMetrics.shares && (
                    <Line 
                      type="monotone" 
                      dataKey="shares" 
                      stroke="#22c55e" 
                      strokeWidth={2}
                      dot={{ fill: '#22c55e', strokeWidth: 0, r: 3 }}
                      activeDot={{ r: 5 }}
                      name="Shares"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No engagement data yet</h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  Engagement history will appear here as posts are scraped. Rescrape posts to start tracking trends.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Creators & Posts</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button 
                variant="outline" 
                onClick={handleScrapeAll} 
                disabled={isScrapingAll || campaignLinks.length === 0}
                data-testid="button-scrape-all"
              >
                {isScrapingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Scrape All
              </Button>
              <Button 
                variant="outline" 
                onClick={downloadCSV} 
                disabled={campaignLinks.length === 0}
                data-testid="button-download-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
              <Button 
                variant="outline" 
                onClick={() => document.getElementById("csv-import-input")?.click()}
                disabled={importing}
                data-testid="button-import-csv"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Import CSV
              </Button>
              <input
                id="csv-import-input"
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="hidden"
              />
              <Button onClick={() => setAddCreatorOpen(true)} data-testid="button-add-creator">
                <Plus className="h-4 w-4 mr-2" />
                Add Creator
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {campaignLinks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No creators yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add creators to track their posts and engagement
                </p>
                <Button onClick={() => setAddCreatorOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Creator
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Creator</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">Likes</TableHead>
                      <TableHead className="text-right">Comments</TableHead>
                      <TableHead className="text-right">Shares</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignLinks.map((link) => {
                      const isPlaceholder = link.url.startsWith("placeholder://");
                      const statusOption = POST_STATUS_OPTIONS.find((o) => o.value === link.postStatus) || POST_STATUS_OPTIONS[0];

                      return (
                        <TableRow key={link.id} data-testid={`row-link-${link.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {link.creatorName || "Unknown"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isPlaceholder ? (
                              <Badge variant="outline" className="text-xs">
                                <LinkIcon className="h-3 w-3 mr-1" />
                                No link yet
                              </Badge>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Badge className={`text-xs ${getPlatformColor(link.platform)}`}>
                                  {link.platform}
                                </Badge>
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={link.postStatus}
                              onValueChange={(v) => handleStatusChange(link.id, v as PostStatus)}
                            >
                              <SelectTrigger
                                className={`w-[100px] h-7 text-xs ${statusOption.color}`}
                                data-testid={`select-status-${link.id}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {POST_STATUS_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {isPlaceholder ? "-" : formatNumber(link.views)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {isPlaceholder ? "-" : formatNumber(link.likes)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {isPlaceholder ? "-" : formatNumber(link.comments)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {isPlaceholder ? "-" : formatNumber(link.shares)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEditLink(link)}
                                data-testid={`button-edit-${link.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setLinkToDelete(link)}
                                data-testid={`button-delete-${link.id}`}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              {isPlaceholder ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditLink(link)}
                                  data-testid={`button-add-url-${link.id}`}
                                >
                                  <LinkIcon className="h-3 w-3 mr-1" />
                                  Add Link
                                </Button>
                              ) : (
                                <>
                                  {link.status === "scraping" && (
                                    <Badge variant="outline" className="text-xs">
                                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                      Scraping
                                    </Badge>
                                  )}
                                  {link.status === "error" && (
                                    <Badge variant="destructive" className="text-xs">
                                      Error
                                    </Badge>
                                  )}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    disabled={isRescraping || link.status === "scraping"}
                                    onClick={() => rescrape(link.id)}
                                    data-testid={`button-rescrape-${link.id}`}
                                  >
                                    <RefreshCw className={`h-4 w-4 ${isRescraping ? "animate-spin" : ""}`} />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AddCreatorModal
        open={addCreatorOpen}
        onOpenChange={setAddCreatorOpen}
        campaignId={campaignId || 0}
      />

      <EditLinkModal
        open={!!editLink}
        onOpenChange={(open) => !open && setEditLink(null)}
        link={editLink}
      />

      <ShareCampaignModal
        campaignId={campaignId || 0}
        initialEnabled={campaign.shareEnabled}
        initialSlug={campaign.shareSlug}
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
      />

      <AlertDialog open={!!linkToDelete} onOpenChange={(open) => !open && setLinkToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Creator</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{linkToDelete?.creatorName || "this creator"}" from this campaign? 
              This will delete all associated engagement data and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCreator}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
