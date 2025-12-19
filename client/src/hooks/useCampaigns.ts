import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

// Campaign with aggregated stats from social links
export interface Campaign {
  id: number;
  name: string;
  songTitle: string;
  songArtist: string | null;
  status: string;
  createdAt: string;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalEngagement: number;
  postCount: number;
  // Sharing fields
  shareSlug: string | null;
  shareEnabled: boolean;
  shareCreatedAt: string | null;
}

export interface NewCampaignData {
  name: string;
  songTitle: string;
  songArtist?: string;
  status?: string;
}

export type PostStatus = "pending" | "briefed" | "active" | "done";

export interface SocialLink {
  id: number;
  campaignId: number;
  url: string;
  platform: string;
  postId: string | null;
  creatorName: string | null;
  postStatus: PostStatus;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  engagementRate: number | null;
  lastScrapedAt: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

export function useCampaigns() {
  return useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });
}

export function useAddCampaign() {
  return useMutation({
    mutationFn: async (data: NewCampaignData) => {
      const response = await apiRequest("POST", "/api/campaigns", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
  });
}

export function useUpdateCampaignStatus() {
  return useMutation({
    mutationFn: async (data: { id: number; status: string }) => {
      const response = await apiRequest("PATCH", `/api/campaigns/${data.id}/status`, { status: data.status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
  });
}

export function useSocialLinks() {
  return useQuery<SocialLink[]>({
    queryKey: ["/api/social-links"],
    refetchInterval: 5000,
  });
}

export function useCampaignSocialLinks(campaignId: number) {
  return useQuery<SocialLink[]>({
    queryKey: ["/api/campaigns", campaignId, "social-links"],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/social-links`);
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    },
    enabled: !!campaignId,
  });
}

export function useAddSocialLink() {
  return useMutation({
    mutationFn: async (data: { url: string; campaignId: number; creatorName?: string; postStatus?: PostStatus }) => {
      const response = await apiRequest("POST", "/api/social-links", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
  });
}

export function useUpdateSocialLink() {
  return useMutation({
    mutationFn: async (data: { 
      id: number; 
      postStatus?: PostStatus; 
      creatorName?: string; 
      url?: string;
      views?: number;
      likes?: number;
      comments?: number;
      shares?: number;
    }) => {
      const { id, ...updateData } = data;
      const response = await apiRequest("PATCH", `/api/social-links/${id}`, updateData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
  });
}

export function useDeleteSocialLink() {
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/social-links/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
  });
}

export function useRescrapeSocialLink() {
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/social-links/${id}/rescrape`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
  });
}

export function useRescrapeAllCampaignLinks() {
  return useMutation({
    mutationFn: async (campaignId: number) => {
      const response = await apiRequest("POST", `/api/campaigns/${campaignId}/rescrape-all`, {});
      const data = await response.json();
      return { ...data, campaignId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", data.campaignId, "engagement-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", data.campaignId, "active-scrape-job"] });
    },
  });
}

export type ScrapeJobStatus = "queued" | "running" | "done" | "failed";
export type ScrapeTaskStatus = "queued" | "running" | "success" | "failed";

export interface ScrapeJobWithStats {
  id: number;
  campaignId: number;
  status: ScrapeJobStatus;
  createdAt: string;
  completedAt: string | null;
  totalTasks: number;
  completedTasks: number;
  successfulTasks: number;
  failedTasks: number;
}

export interface ScrapeTask {
  id: number;
  jobId: number;
  socialLinkId: number;
  url: string;
  platform: string;
  status: ScrapeTaskStatus;
  attempts: number;
  lastError: string | null;
  resultViews: number | null;
  resultLikes: number | null;
  resultComments: number | null;
  resultShares: number | null;
  updatedAt: string;
}

export function useActiveScrapeJob(campaignId: number, enabled: boolean = true) {
  return useQuery<ScrapeJobWithStats | null>({
    queryKey: ["/api/campaigns", campaignId, "active-scrape-job"],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/active-scrape-job`);
      if (!response.ok) throw new Error("Failed to fetch active scrape job");
      return response.json();
    },
    enabled: !!campaignId && enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      if (data.status === "done" || data.status === "failed") return false;
      return 3000;
    },
  });
}

export function useScrapeJob(jobId: number | null) {
  return useQuery<ScrapeJobWithStats>({
    queryKey: ["/api/scrape-jobs", jobId],
    queryFn: async () => {
      const response = await fetch(`/api/scrape-jobs/${jobId}`);
      if (!response.ok) throw new Error("Failed to fetch scrape job");
      return response.json();
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 3000;
      if (data.status === "done" || data.status === "failed") return false;
      return 3000;
    },
  });
}

export function useScrapeTasks(jobId: number | null) {
  return useQuery<ScrapeTask[]>({
    queryKey: ["/api/scrape-jobs", jobId, "tasks"],
    queryFn: async () => {
      const response = await fetch(`/api/scrape-jobs/${jobId}/tasks`);
      if (!response.ok) throw new Error("Failed to fetch scrape tasks");
      return response.json();
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.length === 0) return 3000;
      const allComplete = data.every(t => t.status === "success" || t.status === "failed");
      if (allComplete) return false;
      return 3000;
    },
  });
}

export function useDeleteCampaign() {
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/campaigns/${id}`);
      return { ...(await response.json()), deletedId: id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/social-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", data.deletedId, "engagement-history"] });
    },
  });
}

export interface EngagementHistoryPoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  totalEngagement: number;
}

export function useCampaignEngagementHistory(campaignId: number) {
  return useQuery<EngagementHistoryPoint[]>({
    queryKey: ["/api/campaigns", campaignId, "engagement-history"],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/engagement-history`);
      if (!response.ok) throw new Error("Failed to fetch engagement history");
      return response.json();
    },
    enabled: !!campaignId,
    refetchInterval: 30000,
  });
}

export interface CampaignMetrics {
  totals: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
  timeSeries: {
    date: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }[];
  trackedPostsCount: number;
  lastUpdatedAt: string | null;
}

export function useCampaignMetrics(campaignId: number, days: number = 30) {
  return useQuery<CampaignMetrics>({
    queryKey: ["/api/campaigns", campaignId, "metrics", days],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/metrics?days=${days}`);
      if (!response.ok) throw new Error("Failed to fetch campaign metrics");
      return response.json();
    },
    enabled: !!campaignId,
    refetchInterval: 30000,
  });
}

export interface LiveTrackerStatus {
  isRunning: boolean;
  isScheduled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export function useLiveTrackerStatus() {
  return useQuery<LiveTrackerStatus>({
    queryKey: ["/api/live-tracker/status"],
    refetchInterval: 60000,
  });
}
