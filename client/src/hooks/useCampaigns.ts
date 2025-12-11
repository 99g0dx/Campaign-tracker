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
}

export interface NewCampaignData {
  name: string;
  songTitle: string;
  songArtist?: string;
  status?: string;
}

export interface SocialLink {
  id: number;
  campaignId: number;
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
    mutationFn: async (data: { url: string; campaignId: number }) => {
      const response = await apiRequest("POST", "/api/social-links", data);
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
