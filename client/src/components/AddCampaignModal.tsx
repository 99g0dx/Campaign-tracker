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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export interface NewCampaignData {
  name: string;
  channel: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  engagementRate: number;
}

interface AddCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: NewCampaignData) => Promise<void>;
}

const initialFormState: NewCampaignData = {
  name: "",
  channel: "TikTok",
  status: "Active",
  spend: 0,
  impressions: 0,
  clicks: 0,
  conversions: 0,
  revenue: 0,
  engagementRate: 0,
};

export default function AddCampaignModal({
  open,
  onOpenChange,
  onSubmit,
}: AddCampaignModalProps) {
  const [formData, setFormData] = useState<NewCampaignData>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: keyof NewCampaignData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      setFormData(initialFormState);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create campaign:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setFormData(initialFormState);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="modal-add-campaign">
        <DialogHeader>
          <DialogTitle>Add New Campaign</DialogTitle>
          <DialogDescription>
            Create a new marketing campaign to track its performance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name</Label>
              <Input
                id="name"
                placeholder="Enter campaign name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                data-testid="input-campaign-name"
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="channel">Channel</Label>
                <Select
                  value={formData.channel}
                  onValueChange={(value) => handleChange("channel", value)}
                >
                  <SelectTrigger data-testid="select-channel">
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TikTok">TikTok</SelectItem>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="YouTube">YouTube</SelectItem>
                    <SelectItem value="Facebook">Facebook</SelectItem>
                    <SelectItem value="Twitter">Twitter</SelectItem>
                    <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleChange("status", value)}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Paused">Paused</SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Metrics
            </h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="spend">Spend ($)</Label>
                <Input
                  id="spend"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.spend || ""}
                  onChange={(e) => handleChange("spend", parseFloat(e.target.value) || 0)}
                  data-testid="input-spend"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="revenue">Revenue ($)</Label>
                <Input
                  id="revenue"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.revenue || ""}
                  onChange={(e) => handleChange("revenue", parseFloat(e.target.value) || 0)}
                  data-testid="input-revenue"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="impressions">Impressions</Label>
                <Input
                  id="impressions"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.impressions || ""}
                  onChange={(e) => handleChange("impressions", parseInt(e.target.value) || 0)}
                  data-testid="input-impressions"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clicks">Clicks</Label>
                <Input
                  id="clicks"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.clicks || ""}
                  onChange={(e) => handleChange("clicks", parseInt(e.target.value) || 0)}
                  data-testid="input-clicks"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="conversions">Conversions</Label>
                <Input
                  id="conversions"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.conversions || ""}
                  onChange={(e) => handleChange("conversions", parseInt(e.target.value) || 0)}
                  data-testid="input-conversions"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="engagementRate">Engagement Rate (%)</Label>
                <Input
                  id="engagementRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="0.0"
                  value={formData.engagementRate || ""}
                  onChange={(e) =>
                    handleChange("engagementRate", parseFloat(e.target.value) || 0)
                  }
                  data-testid="input-engagement-rate"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4">
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
