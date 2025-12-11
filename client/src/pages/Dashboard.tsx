import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  BarChart3,
  Users,
  Target,
  CheckCircle,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import KPICard from "@/components/KPICard";
import PerformanceChart from "@/components/PerformanceChart";
import CreativeStatusChart from "@/components/CreativeStatusChart";
import CampaignTable, { type Campaign } from "@/components/CampaignTable";
import EditingTaskCard, { type EditingTask } from "@/components/EditingTaskCard";
import AddCampaignModal, { type NewCampaignData } from "@/components/AddCampaignModal";
import { useFirebase } from "@/hooks/useFirebase";
import { useToast } from "@/hooks/use-toast";

// Mock performance data (would come from aggregated campaign data in production)
// todo: replace with real aggregated data from Firebase
const performanceData = [
  { date: "Dec 5", conversions: 800, clicks: 12000 },
  { date: "Dec 6", conversions: 1200, clicks: 15000 },
  { date: "Dec 7", conversions: 1800, clicks: 24000 },
  { date: "Dec 8", conversions: 2200, clicks: 28000 },
  { date: "Dec 9", conversions: 3000, clicks: 35000 },
  { date: "Dec 10", conversions: 4500, clicks: 42000 },
  { date: "Dec 11", conversions: 6000, clicks: 50000 },
];

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Campaign Tracker</h1>
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
      </header>
      <main className="mx-auto max-w-screen-2xl space-y-8 px-6 py-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="mb-2 h-10 w-32" />
              <Skeleton className="h-4 w-20" />
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <Skeleton className="mb-4 h-6 w-40" />
            <Skeleton className="h-80 w-full" />
          </Card>
          <Card className="p-6">
            <Skeleton className="mb-4 h-6 w-40" />
            <Skeleton className="h-80 w-full" />
          </Card>
        </div>
      </main>
    </div>
  );
}

function ConfigurationPrompt() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Campaign Tracker</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-screen-2xl px-6 py-16">
        <Card className="mx-auto max-w-xl p-8">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="rounded-full bg-yellow-500/10 p-4">
              <AlertCircle className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Firebase Configuration Required</h2>
              <p className="text-muted-foreground">
                To use the Campaign Tracker, you need to configure Firebase with your project
                credentials. Please add the following environment variables:
              </p>
            </div>
            <div className="w-full space-y-2 rounded-lg bg-muted p-4 text-left font-mono text-sm">
              <p>VITE_FIREBASE_API_KEY</p>
              <p>VITE_FIREBASE_PROJECT_ID</p>
              <p>VITE_FIREBASE_APP_ID</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Get these values from your Firebase Console under Project Settings.
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}

export default function Dashboard() {
  const { campaigns, editingTasks, loading, error, isConfigured, addCampaign } = useFirebase();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { toast } = useToast();

  // Calculate KPIs from campaign data
  const kpis = useMemo(() => {
    if (campaigns.length === 0) {
      return { roi: 0, cpa: 0, engagedUsers: 0, completionRate: 0 };
    }

    const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
    const totalRevenue = campaigns.reduce((sum, c) => {
      const revenue = c.spend * (1 + c.roi / 100);
      return sum + revenue;
    }, 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);

    const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
    const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const engagedUsers = Math.round(totalConversions * 1.8);

    const approvedTasks = editingTasks.filter((t) => t.status === "Approved").length;
    const completionRate =
      editingTasks.length > 0 ? (approvedTasks / editingTasks.length) * 100 : 0;

    return { roi, cpa, engagedUsers, completionRate };
  }, [campaigns, editingTasks]);

  // Calculate creative status distribution
  const creativeStatusData = useMemo(() => {
    if (editingTasks.length === 0) return [];
    const buckets: Record<string, number> = {};
    editingTasks.forEach((t) => {
      buckets[t.status] = (buckets[t.status] || 0) + 1;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [editingTasks]);

  const handleAddCampaign = async (data: NewCampaignData) => {
    try {
      await addCampaign(data);
      toast({
        title: "Campaign created",
        description: `"${data.name}" has been added successfully.`,
      });
    } catch (err) {
      console.error("Failed to add campaign:", err);
      toast({
        title: "Error",
        description: "Failed to create campaign. Please try again.",
        variant: "destructive",
      });
      throw err;
    }
  };

  const handleCampaignClick = (campaign: Campaign) => {
    console.log("Viewing campaign:", campaign.name);
  };

  const handleTaskClick = (task: EditingTask) => {
    console.log("Viewing task:", task.title);
  };

  // Show configuration prompt if Firebase is not configured
  if (!isConfigured) {
    return <ConfigurationPrompt />;
  }

  // Show loading state
  if (loading) {
    return <LoadingSkeleton />;
  }

  // Show error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="max-w-md p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h2 className="mb-2 text-xl font-semibold">Something went wrong</h2>
          <p className="text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }

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
          {editingTasks.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {editingTasks.map((task) => (
                <EditingTaskCard key={task.id} task={task} onClick={handleTaskClick} />
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No editing tasks yet. Add your first task to get started.</p>
            </Card>
          )}
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
