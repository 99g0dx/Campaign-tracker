import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

type AuthUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  isVerified: boolean;
  profileImageUrl: string | null;
};

type AuthResponse = {
  user: AuthUser | null;
};

export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<AuthResponse>({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await apiRequest("POST", "/api/auth/login", credentials);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to log in");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; fullName?: string; phone?: string }) => {
      const response = await apiRequest("POST", "/api/auth/signup", data);
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Failed to create account");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/logout");
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to log out");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/";
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/auth/verify", { code });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Invalid or expired verification code");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const resendCodeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/resend-code");
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to resend code");
      }
      return response.json();
    },
  });

  const user = data?.user ?? undefined;

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutateAsync,
    loginPending: loginMutation.isPending,
    loginError: loginMutation.error,
    signup: signupMutation.mutateAsync,
    signupPending: signupMutation.isPending,
    signupError: signupMutation.error,
    logout: logoutMutation.mutate,
    logoutPending: logoutMutation.isPending,
    verify: verifyMutation.mutateAsync,
    verifyPending: verifyMutation.isPending,
    verifyError: verifyMutation.error,
    resendCode: resendCodeMutation.mutateAsync,
    resendCodePending: resendCodeMutation.isPending,
  };
}
