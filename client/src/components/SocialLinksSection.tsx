import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Link2,
  RefreshCw,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  ExternalLink,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { SiTiktok, SiInstagram, SiYoutube, SiX, SiFacebook } from "react-icons/si";
import { cn } from "@/lib/utils";
import {
  useSocialLinks,
  useAddSocialLink,
  useRescrapeSocialLink,
  useCampaigns,
  type SocialLink,
} from "@/hooks/useCampaigns";
import { useToast } from "@/hooks/use-toast";

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  TikTok: <SiTiktok className="h-4 w-4" />,
  Instagram: <SiInstagram className="h-4 w-4" />,
  YouTube: <SiYoutube className="h-4 w-4" />,
  Twitter: <SiX className="h-4 w-4" />,
  Facebook: <SiFacebook className="h-4 w-4" />,
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: "bg-yellow-500/10", text: "text-yellow-500" },
  scraping: { bg: "bg-blue-500/10", text: "text-blue-500" },
  scraped: { bg: "bg-emerald-500/10", text: "text-emerald-500" },
  error: { bg: "bg-red-500/10", text: "text-red-500" },
};

function formatNumber(num: number | null): string {
  if (num === null || num === undefined) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function SocialLinkCard({
  link,
  onRescrape,
  isRescraping,
}: {
  link: SocialLink;
  onRescrape: (id: number) => void;
  isRescraping: boolean;
}) {
  const statusStyle = STATUS_STYLES[link.status] || STATUS_STYLES.pending;
  const isLoading = link.status === "scraping" || link.status === "pending";

  return (
    <Card className="p-4" data-testid={`card-social-link-${link.id}`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
              {PLATFORM_ICONS[link.platform] || <Link2 className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{link.platform}</p>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              >
                <span className="truncate max-w-[180px]">{link.url}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn(statusStyle.bg, statusStyle.text, "border-0 text-xs")}>
              {isLoading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {link.status}
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onRescrape(link.id)}
              disabled={isRescraping || isLoading}
              data-testid={`button-rescrape-${link.id}`}
            >
              <RefreshCw className={cn("h-4 w-4", isRescraping && "animate-spin")} />
            </Button>
          </div>
        </div>

        {link.status === "error" && link.errorMessage && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="line-clamp-2">{link.errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col items-center rounded-md bg-muted p-2">
            <Eye className="mb-1 h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{formatNumber(link.views)}</span>
            <span className="text-xs text-muted-foreground">Views</span>
          </div>
          <div className="flex flex-col items-center rounded-md bg-muted p-2">
            <Heart className="mb-1 h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{formatNumber(link.likes)}</span>
            <span className="text-xs text-muted-foreground">Likes</span>
          </div>
          <div className="flex flex-col items-center rounded-md bg-muted p-2">
            <MessageCircle className="mb-1 h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{formatNumber(link.comments)}</span>
            <span className="text-xs text-muted-foreground">Comments</span>
          </div>
          <div className="flex flex-col items-center rounded-md bg-muted p-2">
            <Share2 className="mb-1 h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{formatNumber(link.shares)}</span>
            <span className="text-xs text-muted-foreground">Shares</span>
          </div>
        </div>

        {link.lastScrapedAt && (
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date(link.lastScrapedAt).toLocaleString()}
          </p>
        )}
      </div>
    </Card>
  );
}

function AddLinkDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const [campaignId, setCampaignId] = useState<string>("");
  const { data: campaigns = [] } = useCampaigns();
  const addLinkMutation = useAddSocialLink();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      toast({
        title: "Error",
        description: "Please enter a URL",
        variant: "destructive",
      });
      return;
    }

    try {
      const parsedCampaignId = campaignId ? parseInt(campaignId, 10) : undefined;
      if (!parsedCampaignId) {
        toast({
          title: "Error",
          description: "Please select a campaign",
          variant: "destructive",
        });
        return;
      }

      await addLinkMutation.mutateAsync({
        url: url.trim(),
        campaignId: parsedCampaignId,
      });

      toast({
        title: "Link added",
        description: "Scraping engagement data in the background...",
      });

      setUrl("");
      setCampaignId("");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to add link:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add link",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Social Media Link</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">URL</label>
            <Input
              type="url"
              placeholder="https://www.tiktok.com/@user/video/123..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-testid="input-social-url"
            />
            <p className="text-xs text-muted-foreground">
              Supported: TikTok, Instagram, YouTube, Twitter, Facebook
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Link to Campaign (optional)</label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger data-testid="select-campaign">
                <SelectValue placeholder="Select a campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No campaign</SelectItem>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id.toString()}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addLinkMutation.isPending}
              data-testid="button-submit-link"
            >
              {addLinkMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Link
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SocialLinksSection() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { data: links = [], isLoading } = useSocialLinks();
  const rescrapeMutation = useRescrapeSocialLink();

  const handleRescrape = async (id: number) => {
    try {
      await rescrapeMutation.mutateAsync(id);
    } catch (error) {
      console.error("Failed to rescrape:", error);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Social Media Links</h2>
          <p className="text-sm text-muted-foreground">
            Track engagement from your social media posts
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-social-link">
          <Plus className="mr-2 h-4 w-4" />
          Add Link
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="h-48 animate-pulse bg-muted" />
          ))}
        </div>
      ) : links.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <SocialLinkCard
              key={link.id}
              link={link}
              onRescrape={handleRescrape}
              isRescraping={rescrapeMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Link2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 font-medium">No social links yet</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Add your first social media link to start tracking engagement
          </p>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Your First Link
          </Button>
        </Card>
      )}

      <AddLinkDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
    </section>
  );
}
