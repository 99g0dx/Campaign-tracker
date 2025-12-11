import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

// Campaign types matching backend response
export interface Campaign {
  id: number;
  name: string;
  channel: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  engagementRate: number;
  cpa: number;
  roi: number;
  createdAt: string;
}

export interface EditingTask {
  id: number;
  title: string;
  campaignName: string;
  assignee: string;
  status: string;
  dueDate: string;
  createdAt: string;
}

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

export function useCampaigns() {
  return useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });
}

export function useEditingTasks() {
  return useQuery<EditingTask[]>({
    queryKey: ["/api/editing-tasks"],
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

export function useAddEditingTask() {
  return useMutation({
    mutationFn: async (data: {
      title: string;
      campaignName: string;
      assignee: string;
      status: string;
      dueDate: string;
    }) => {
      const response = await apiRequest("POST", "/api/editing-tasks", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/editing-tasks"] });
    },
  });
}

// Social Links types
export interface SocialLink {
  id: number;
  campaignId: number | null;
  url: string;
  platform: string;
  postId: string | null;
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

export function useSocialLinks() {
  return useQuery<SocialLink[]>({
    queryKey: ["/api/social-links"],
    refetchInterval: 5000, // Poll every 5s to catch scraping updates
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
    mutationFn: async (data: { url: string; campaignId?: number }) => {
      const response = await apiRequest("POST", "/api/social-links", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social-links"] });
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
    },
  });
}
