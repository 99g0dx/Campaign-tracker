import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["/auth/user"],
    queryFn: getQueryFn<User | null>({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const login = () => {
    setIsRedirecting(true);
    window.location.href = "/auth/login";
  };

  const logout = () => {
    setIsRedirecting(true);
    window.location.href = "/auth/logout";
  };

  return {
    user: user ?? undefined,
    isLoading: isLoading || isRedirecting,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
