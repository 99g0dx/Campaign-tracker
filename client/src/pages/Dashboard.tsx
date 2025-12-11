import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus, BarChart3, TrendingUp, Users, Target, CheckCircle, DollarSign } from "lucide-react";
import KPICard from "@/components/KPICard";
import PerformanceChart from "@/components/PerformanceChart";
import CreativeStatusChart from "@/components/CreativeStatusChart";
import CampaignTable, { type Campaign } from "@/components/CampaignTable";
import EditingTaskCard, { type EditingTask } from "@/components/EditingTaskCard";
import AddCampaignModal, { type NewCampaignData } from "@/components/AddCampaignModal";

// todo: remove mock functionality - this data will come from Firebase
const initialCampaigns: Campaign[] = [
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
];

// todo: remove mock functionality
const editingTasks: EditingTask[] = [
  {
    id: "1",
    title: "Somersaults TikTok Edit v1",
    campaignName: "Kah-Lo - Somersaults TikTok Push",
    assignee: "Tomi",
    status: "Editing",
    dueDate: "Dec 12, 2025",
  },
  {
    id: "2",
    title: "Rema Challenge Overlay Pack",
    campaignName: "Rema Fan Edit Challenge",
    assignee: "Ada",
    status: "In Review",
    dueDate: "Dec 13, 2025",
  },
  {
    id: "3",
    title: "UGC Script Refine",
    campaignName: "Brand UGC Influencer Sprint",
    assignee: "Emeka",
    status: "Approved",
    dueDate: "Dec 10, 2025",
  },
  {
    id: "4",
    title: "Instagram Reels Cutdown",
    campaignName: "Rema Fan Edit Challenge",
    assignee: "Daye",
    status: "Briefing",
    dueDate: "Dec 14, 2025",
  },
  {
    id: "5",
    title: "YouTube Thumbnail Concepts",
    campaignName: "Brand UGC Influencer Sprint",
    assignee: "Zee",
    status: "Blocked",
    dueDate: "Dec 13, 2025",
  },
];

// todo: remove mock functionality
const performanceData = [
  { date: "Dec 5", conversions: 800, clicks: 12000 },
  { date: "Dec 6", conversions: 1200, clicks: 15000 },
  { date: "Dec 7", conversions: 1800, clicks: 24000 },
  { date: "Dec 8", conversions: 2200, clicks: 28000 },
  { date: "Dec 9", conversions: 3000, clicks: 35000 },
  { date: "Dec 10", conversions: 4500, clicks: 42000 },
  { date: "Dec 11", conversions: 6000, clicks: 50000 },
];

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Calculate KPIs from campaign data
  const kpis = useMemo(() => {
    const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
    const totalRevenue = campaigns.reduce((sum, c) => {
      const revenue = c.spend * (1 + c.roi / 100);
      return sum + revenue;
    }, 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
    const avgEngagement =
      campaigns.length > 0
        ? campaigns.reduce((sum, c) => sum + c.engagementRate, 0) / campaigns.length
        : 0;

    const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
    const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const engagedUsers = Math.round(totalConversions * 1.8);

    const approvedTasks = editingTasks.filter((t) => t.status === "Approved").length;
    const completionRate =
      editingTasks.length > 0 ? (approvedTasks / editingTasks.length) * 100 : 0;

    return { roi, cpa, engagedUsers, completionRate, avgEngagement };
  }, [campaigns]);

  // Calculate creative status distribution
  const creativeStatusData = useMemo(() => {
    const buckets: Record<string, number> = {};
    editingTasks.forEach((t) => {
      buckets[t.status] = (buckets[t.status] || 0) + 1;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, []);

  const handleAddCampaign = async (data: NewCampaignData) => {
    // todo: replace with Firebase addDoc
    const newCampaign: Campaign = {
      id: String(Date.now()),
      name: data.name,
      channel: data.channel,
      status: data.status as Campaign["status"],
      spend: data.spend,
      impressions: data.impressions,
      clicks: data.clicks,
      conversions: data.conversions,
      cpa: data.conversions > 0 ? data.spend / data.conversions : 0,
      roi: data.spend > 0 ? ((data.revenue - data.spend) / data.spend) * 100 : 0,
      engagementRate: data.engagementRate,
    };
    setCampaigns((prev) => [newCampaign, ...prev]);
    console.log("Campaign added:", newCampaign);
  };

  const handleCampaignClick = (campaign: Campaign) => {
    console.log("Viewing campaign:", campaign.name);
  };

  const handleTaskClick = (task: EditingTask) => {
    console.log("Viewing task:", task.title);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Campaign Tracker</h1>
          </div>
          <Button onClick={() => setIsAddModalOpen(true)} data-testid="button-add-campaign">
            <Plus className="mr-2 h-4 w-4" />
            Add Campaign
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl space-y-8 px-6 py-8">
        {/* KPI Cards */}
        <section>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              label="ROI"
              value={kpis.roi.toFixed(1)}
              suffix="%"
              trend={12.3}
              icon={<DollarSign className="h-5 w-5" />}
            />
            <KPICard
              label="Cost Per Acquisition"
              value={kpis.cpa.toFixed(2)}
              prefix="$"
              trend={-8.2}
              icon={<Target className="h-5 w-5" />}
            />
            <KPICard
              label="Engaged Users"
              value={kpis.engagedUsers}
              trend={24.1}
              icon={<Users className="h-5 w-5" />}
            />
            <KPICard
              label="Content Completion"
              value={kpis.completionRate.toFixed(0)}
              suffix="%"
              trend={5.0}
              icon={<CheckCircle className="h-5 w-5" />}
            />
          </div>
        </section>

        {/* Charts Section */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <PerformanceChart data={performanceData} title="7-Day Performance Trend" />
          <CreativeStatusChart data={creativeStatusData} title="Creative Production Status" />
        </section>

        {/* Campaign Table */}
        <section>
          <CampaignTable campaigns={campaigns} onCampaignClick={handleCampaignClick} />
        </section>

        {/* Editing Tasks Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-medium">Editing Tasks</h2>
            <Button variant="outline" size="sm" data-testid="button-add-task">
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {editingTasks.map((task) => (
              <EditingTaskCard key={task.id} task={task} onClick={handleTaskClick} />
            ))}
          </div>
        </section>
      </main>

      <AddCampaignModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSubmit={handleAddCampaign}
      />
    </div>
  );
}
