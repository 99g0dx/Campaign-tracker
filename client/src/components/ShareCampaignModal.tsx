import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Copy, Link, Lock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Props = {
  campaignId: number;
  initialEnabled?: boolean;
  initialSlug?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShareUpdated?: () => void;
};

export default function ShareCampaignModal({
  campaignId,
  initialEnabled = false,
  initialSlug = null,
  open,
  onOpenChange,
  onShareUpdated,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [shareSlug, setShareSlug] = useState<string | null>(initialSlug);
  const { toast } = useToast();

  const shareLink = shareSlug 
    ? `${window.location.origin}/share/${shareSlug}` 
    : null;

  async function handleSave() {
    if (enabled && !password.trim()) {
      toast({
        title: "Password required",
        description: "Please enter a password to protect your shared campaign.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await apiRequest(
        "POST",
        `/api/campaigns/${campaignId}/share`,
        {
          enable: enabled,
          password: enabled ? password : undefined,
        }
      );

      const data = await response.json();
      
      if (data.shareEnabled && data.shareSlug) {
        setShareSlug(data.shareSlug);
      } else {
        setShareSlug(null);
      }

      toast({
        title: enabled ? "Sharing enabled" : "Sharing disabled",
        description: enabled 
          ? "Your campaign is now shareable with the password you set."
          : "Your campaign is no longer shareable.",
      });

      onShareUpdated?.();
      setPassword("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update sharing settings.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function copyToClipboard() {
    if (shareLink) {
      await navigator.clipboard.writeText(shareLink);
      toast({
        title: "Copied!",
        description: "Share link copied to clipboard.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Share Campaign
          </DialogTitle>
          <DialogDescription>
            Create a password-protected link to share this campaign with your team or clients. They will only see the campaign data and stats.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="share-enabled">Enable sharing</Label>
              <p className="text-xs text-muted-foreground">
                Allow others to view this campaign with a password
              </p>
            </div>
            <Switch
              id="share-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
              data-testid="switch-share-enabled"
            />
          </div>

          {enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="share-password">Password</Label>
                <Input
                  id="share-password"
                  type="password"
                  placeholder="Enter a password for viewers"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="input-share-password"
                />
                <p className="text-xs text-muted-foreground">
                  Anyone with this password can view the campaign
                </p>
              </div>

              {shareLink && (
                <div className="space-y-2">
                  <Label>Share link</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={shareLink}
                      className="text-sm"
                      data-testid="input-share-link"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={copyToClipboard}
                      data-testid="button-copy-link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-share"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            data-testid="button-save-share"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
