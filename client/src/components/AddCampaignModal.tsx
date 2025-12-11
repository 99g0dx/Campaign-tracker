import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { NewCampaignData } from "@/hooks/useCampaigns";

interface AddCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: NewCampaignData) => Promise<void>;
}

export default function AddCampaignModal({
  open,
  onOpenChange,
  onSubmit,
}: AddCampaignModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    songTitle: "",
    songArtist: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.songTitle.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: formData.name,
        songTitle: formData.songTitle,
        songArtist: formData.songArtist || undefined,
      });
      setFormData({ name: "", songTitle: "", songArtist: "" });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create campaign:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setFormData({ name: "", songTitle: "", songArtist: "" });
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="modal-add-campaign">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
          <DialogDescription>
            Start a new campaign to track social media performance for a song.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              placeholder="e.g., Summer Vibes Launch"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              data-testid="input-campaign-name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="songTitle">Song Title</Label>
            <Input
              id="songTitle"
              placeholder="e.g., Summertime"
              value={formData.songTitle}
              onChange={(e) => setFormData({ ...formData, songTitle: e.target.value })}
              data-testid="input-song-title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="songArtist">Artist (Optional)</Label>
            <Input
              id="songArtist"
              placeholder="e.g., DJ Sunny"
              value={formData.songArtist}
              onChange={(e) => setFormData({ ...formData, songArtist: e.target.value })}
              data-testid="input-song-artist"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} data-testid="button-submit-campaign">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Campaign"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
