import { useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Music,
  Link as LinkIcon,
  RefreshCw,
  ExternalLink,
  Loader2,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import {
  useCampaigns,
  useAddCampaign,
  useSocialLinks,
  useAddSocialLink,
  useRescrapeSocialLink,
  useUpdateSocialLink,
  type Campaign,
  type SocialLink,
  type PostStatus,
} from "@/hooks/useCampaigns";
import AddCampaignModal from "@/components/AddCampaignModal";
import { useToast } from "@/hooks/use-toast";
import { User } from "lucide-react";

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

function CampaignCard({
  campaign,
  socialLinks,
  onAddLink,
}: {
  campaign: Campaign;
  socialLinks: SocialLink[];
  onAddLink: (campaignId: number) => void;
}) {
  const campaignLinks = socialLinks.filter((l) => l.campaignId === campaign.id);
  const { mutate: rescrape, isPending: isRescraping } = useRescrapeSocialLink();
  const { mutate: updateLink } = useUpdateSocialLink();

  const handleStatusChange = (linkId: number, newStatus: PostStatus) => {
    updateLink({ id: linkId, postStatus: newStatus });
  };

  return (
    <Card className="overflow-visible" data-testid={`card-campaign-${campaign.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-lg">{campaign.name}</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Music className="h-4 w-4" />
            <span>{campaign.songTitle}</span>
            {campaign.songArtist && (
              <span className="text-muted-foreground/60">by {campaign.songArtist}</span>
            )}
          </div>
        </div>
        <Badge
          variant={campaign.status === "Active" ? "default" : "secondary"}
          className="shrink-0"
        >
          {campaign.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" />
              Views
            </div>
            <p className="text-xl font-semibold" data-testid={`text-views-${campaign.id}`}>
              {formatNumber(campaign.totalViews)}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Heart className="h-3 w-3" />
              Likes
            </div>
            <p className="text-xl font-semibold" data-testid={`text-likes-${campaign.id}`}>
              {formatNumber(campaign.totalLikes)}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageCircle className="h-3 w-3" />
              Comments
            </div>
            <p className="text-xl font-semibold" data-testid={`text-comments-${campaign.id}`}>
              {formatNumber(campaign.totalComments)}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Share2 className="h-3 w-3" />
              Shares
            </div>
            <p className="text-xl font-semibold" data-testid={`text-shares-${campaign.id}`}>
              {formatNumber(campaign.totalShares)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Posts ({campaignLinks.length})
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAddLink(campaign.id)}
              data-testid={`button-add-link-${campaign.id}`}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Link
            </Button>
          </div>

          {campaignLinks.length > 0 && (
            <div className="space-y-2">
              {campaignLinks.map((link) => {
                const statusOption = POST_STATUS_OPTIONS.find(o => o.value === link.postStatus) || POST_STATUS_OPTIONS[0];
                return (
                  <div
                    key={link.id}
                    className="rounded-md border p-3 text-sm space-y-2"
                    data-testid={`link-${link.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <Badge className={`text-xs ${getPlatformColor(link.platform)}`}>
                          {link.platform}
                        </Badge>
                        {link.creatorName && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            {link.creatorName}
                          </span>
                        )}
                      </div>
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
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-xs"
                      >
                        <span className="truncate max-w-[200px]">{link.url}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                      <div className="flex items-center gap-2 shrink-0">
                        {link.status === "scraped" && (
                          <span className="text-xs text-muted-foreground">
                            {formatNumber(link.views)} views
                          </span>
                        )}
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
                          <RefreshCw className={`h-3 w-3 ${isRescraping ? "animate-spin" : ""}`} />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AddLinkModal({
  open,
  onOpenChange,
  campaignId,
  campaigns,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number | null;
  campaigns: Campaign[];
}) {
  const [url, setUrl] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(campaignId);
  const { mutate: addLink, isPending } = useAddSocialLink();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !selectedCampaignId) return;

    addLink(
      { 
        url, 
        campaignId: selectedCampaignId,
        creatorName: creatorName.trim() || undefined,
      },
      {
        onSuccess: () => {
          setUrl("");
          setCreatorName("");
          onOpenChange(false);
          toast({ title: "Link added", description: "Scraping engagement data..." });
        },
        onError: (error: Error) => {
          toast({ 
            title: "Failed to add link", 
            description: error.message || "Please check the URL and try again",
            variant: "destructive" 
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="modal-add-link">
        <DialogHeader>
          <DialogTitle>Add Social Media Link</DialogTitle>
          <DialogDescription>
            Add a link to a TikTok, Instagram, YouTube, Twitter, or Facebook post.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campaign">Campaign</Label>
            <Select
              value={selectedCampaignId?.toString() || ""}
              onValueChange={(v) => setSelectedCampaignId(parseInt(v, 10))}
            >
              <SelectTrigger data-testid="select-campaign">
                <SelectValue placeholder="Select a campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">Post URL</Label>
            <Input
              id="url"
              placeholder="https://www.tiktok.com/@user/video/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-testid="input-link-url"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="creatorName">Creator Name (optional)</Label>
            <Input
              id="creatorName"
              placeholder="@creator_handle"
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              data-testid="input-creator-name"
            />
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
            <Button type="submit" disabled={isPending || !selectedCampaignId}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                "Add Link"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type SortOption = "name" | "engagement" | "status" | "views";
type PlatformFilter = "all" | "tiktok" | "instagram" | "youtube" | "twitter" | "facebook";

export default function Dashboard() {
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");

  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns();
  const { data: socialLinks, isLoading: linksLoading } = useSocialLinks();
  const { mutateAsync: addCampaign } = useAddCampaign();

  const filteredAndSortedCampaigns = campaigns
    ?.filter((campaign) => {
      if (platformFilter === "all") return true;
      const campaignLinks = socialLinks?.filter((l) => l.campaignId === campaign.id) || [];
      return campaignLinks.some((l) => l.platform.toLowerCase() === platformFilter);
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "engagement":
          return b.totalEngagement - a.totalEngagement;
        case "views":
          return b.totalViews - a.totalViews;
        case "status":
          return a.status.localeCompare(b.status);
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });

  const handleAddLink = (campaignId: number) => {
    setSelectedCampaignId(campaignId);
    setLinkModalOpen(true);
  };

  const totalViews = campaigns?.reduce((sum, c) => sum + c.totalViews, 0) || 0;
  const totalEngagement = campaigns?.reduce((sum, c) => sum + c.totalEngagement, 0) || 0;
  const totalPosts = socialLinks?.length || 0;
  const activeCampaigns = campaigns?.filter((c) => c.status === "Active").length || 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl p-4 md:p-6 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Campaign Tracker</h1>
            <p className="text-muted-foreground">Track your song campaigns and social engagement</p>
          </div>
          <Button onClick={() => setCampaignModalOpen(true)} data-testid="button-new-campaign">
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <Eye className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Views</p>
                  <p className="text-2xl font-bold" data-testid="text-total-views">
                    {formatNumber(totalViews)}
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
                  <p className="text-sm text-muted-foreground">Total Engagement</p>
                  <p className="text-2xl font-bold" data-testid="text-total-engagement">
                    {formatNumber(totalEngagement)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <LinkIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Posts</p>
                  <p className="text-2xl font-bold" data-testid="text-total-posts">
                    {totalPosts}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <Music className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Campaigns</p>
                  <p className="text-2xl font-bold" data-testid="text-active-campaigns">
                    {activeCampaigns}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Campaigns</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={platformFilter}
                  onValueChange={(v) => setPlatformFilter(v as PlatformFilter)}
                >
                  <SelectTrigger className="w-[130px]" data-testid="select-platform-filter">
                    <SelectValue placeholder="Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Platforms</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="twitter">X / Twitter</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={sortBy}
                  onValueChange={(v) => setSortBy(v as SortOption)}
                >
                  <SelectTrigger className="w-[140px]" data-testid="select-sort">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="views">Most Views</SelectItem>
                    <SelectItem value="engagement">Most Engagement</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          {campaignsLoading || linksLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          ) : filteredAndSortedCampaigns && filteredAndSortedCampaigns.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredAndSortedCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  socialLinks={socialLinks || []}
                  onAddLink={handleAddLink}
                />
              ))}
            </div>
          ) : campaigns && campaigns.length > 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Filter className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No matching campaigns</h3>
                <p className="text-muted-foreground mb-4">
                  No campaigns have posts from the selected platform
                </p>
                <Button variant="outline" onClick={() => setPlatformFilter("all")}>
                  Clear Filter
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Music className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first campaign to start tracking engagement
                </p>
                <Button onClick={() => setCampaignModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AddCampaignModal
        open={campaignModalOpen}
        onOpenChange={setCampaignModalOpen}
        onSubmit={addCampaign}
      />

      <AddLinkModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        campaignId={selectedCampaignId}
        campaigns={campaigns || []}
      />
    </div>
  );
}
