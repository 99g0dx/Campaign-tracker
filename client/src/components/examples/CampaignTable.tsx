import CampaignTable, { type Campaign } from "../CampaignTable";

// todo: remove mock functionality
const mockCampaigns: Campaign[] = [
  {
    id: "1",
    name: "Kah-Lo - Somersaults TikTok Push",
    channel: "TikTok",
    status: "Active",
    spend: 500,
    impressions: 120000,
    clicks: 15000,
    conversions: 1200,
    cpa: 0.42,
    roi: 340,
    engagementRate: 14.0,
  },
  {
    id: "2",
    name: "Rema Fan Edit Challenge",
    channel: "Instagram",
    status: "Active",
    spend: 800,
    impressions: 200000,
    clicks: 24000,
    conversions: 1800,
    cpa: 0.44,
    roi: 412.5,
    engagementRate: 18.0,
  },
  {
    id: "3",
    name: "Brand UGC Influencer Sprint",
    channel: "YouTube",
    status: "Completed",
    spend: 1200,
    impressions: 300000,
    clicks: 35000,
    conversions: 3000,
    cpa: 0.40,
    roi: 466.7,
    engagementRate: 16.0,
  },
  {
    id: "4",
    name: "Holiday Season Push",
    channel: "TikTok",
    status: "Paused",
    spend: 350,
    impressions: 80000,
    clicks: 8500,
    conversions: 650,
    cpa: 0.54,
    roi: 185.7,
    engagementRate: 10.6,
  },
  {
    id: "5",
    name: "Q1 Brand Awareness",
    channel: "Facebook",
    status: "Draft",
    spend: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    cpa: 0,
    roi: 0,
    engagementRate: 0,
  },
];

export default function CampaignTableExample() {
  const handleCampaignClick = (campaign: Campaign) => {
    console.log("Campaign clicked:", campaign.name);
  };

  return <CampaignTable campaigns={mockCampaigns} onCampaignClick={handleCampaignClick} />;
}
