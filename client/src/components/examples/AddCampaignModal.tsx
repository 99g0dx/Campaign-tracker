import { useState } from "react";
import AddCampaignModal, { type NewCampaignData } from "../AddCampaignModal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function AddCampaignModalExample() {
  const [open, setOpen] = useState(false);

  const handleSubmit = async (data: NewCampaignData) => {
    console.log("Campaign created:", data);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <div>
      <Button onClick={() => setOpen(true)} data-testid="button-add-campaign">
        <Plus className="mr-2 h-4 w-4" />
        Add Campaign
      </Button>
      <AddCampaignModal open={open} onOpenChange={setOpen} onSubmit={handleSubmit} />
    </div>
  );
}
