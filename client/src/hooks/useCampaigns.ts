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
