import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User, Mail, Phone, Users, Plus, Trash2, Loader2, CheckCircle, ArrowLeft, Lock, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import { WorkspaceInvites } from "@/components/WorkspaceInvites";

type TeamMember = {
  id: number;
  ownerId: string;
  name: string;
  email: string;
  role: string | null;
  createdAt: string | null;
};

type Workspace = {
  id: number;
  name: string;
  ownerId: string;
  createdAt: string;
};

function useTeamMembers() {
  return useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });
}

function useMyWorkspace() {
  return useQuery<Workspace>({
    queryKey: ["/api/workspaces/my-workspace"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workspaces/my-workspace");
      if (!res.ok) throw new Error("Failed to fetch workspace");
      return res.json();
    },
  });
}

function useAddTeamMember() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { name: string; email: string; role?: string }) => {
      const res = await apiRequest("POST", "/api/team-members", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "Team member added" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to add team member", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });
}

function useRemoveTeamMember() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/team-members/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "Team member removed" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to remove team member", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });
}

export default function Profile() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: teamMembers = [], isLoading: membersLoading } = useTeamMembers();
  const { data: workspace, isLoading: workspaceLoading } = useMyWorkspace();
  const addMember = useAddTeamMember();
  const removeMember = useRemoveTeamMember();
  const { toast } = useToast();

  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  // Fetch password status on mount
  useEffect(() => {
    async function checkPasswordStatus() {
      try {
        const res = await fetch("/api/auth/has-password", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setHasPassword(data.hasPassword);
        }
      } catch (error) {
        console.error("Failed to check password status:", error);
      }
    }
    checkPasswordStatus();
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Not logged in</CardTitle>
            <CardDescription>Please log in to view your profile.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button data-testid="button-go-home">Go to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim()) {
      toast({
        title: "Missing fields",
        description: "Please enter a name and email.",
        variant: "destructive",
      });
      return;
    }

    await addMember.mutateAsync({
      name: newMemberName.trim(),
      email: newMemberEmail.trim(),
      role: newMemberRole.trim() || undefined,
    });

    setNewMemberName("");
    setNewMemberEmail("");
    setNewMemberRole("");
    setShowAddForm(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    setPasswordChanging(true);
    try {
      const endpoint = hasPassword ? "/api/auth/change-password" : "/api/auth/set-password";
      const body = hasPassword 
        ? { currentPassword, newPassword }
        : { newPassword };
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      toast({
        title: hasPassword ? "Password changed" : "Password set",
        description: "Your password has been updated successfully.",
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setHasPassword(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPasswordChanging(false);
    }
  }

  const displayName = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || "";
  const initials = displayName 
    ? displayName.split(" ").map((n) => n?.[0]).join("").toUpperCase().slice(0, 2)
    : user.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" data-testid="button-back-dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-profile-title">Profile</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Your Details
            </CardTitle>
            <CardDescription>
              Your account information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
                <AvatarFallback className="text-xl">{initials}</AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-muted-foreground text-sm">Full Name</Label>
                    <p className="font-medium" data-testid="text-full-name">{displayName || "-"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Email
                    </Label>
                    <p className="font-medium" data-testid="text-email">{user.email || "-"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Phone
                    </Label>
                    <p className="font-medium" data-testid="text-phone">{user.phone || "-"}</p>
                  </div>
                </div>

                <div className="pt-2">
                  {user.isVerified ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not Verified</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Password
            </CardTitle>
            <CardDescription>
              {hasPassword === false
                ? "Set a password to enable password login"
                : "Change your account password"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              {hasPassword !== false && (
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      data-testid="input-current-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    data-testid="input-new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="input-confirm-password"
                />
              </div>
              <div className="flex items-center gap-4 pt-2">
                <Button
                  type="submit"
                  disabled={passwordChanging || !newPassword || !confirmPassword || (hasPassword !== false && !currentPassword)}
                  data-testid="button-change-password"
                >
                  {passwordChanging && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {hasPassword === false ? "Set Password" : "Change Password"}
                </Button>
                <Link href="/forgot-password">
                  <Button type="button" variant="ghost" className="text-sm" data-testid="link-forgot-password">
                    Forgot password?
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Members
                </CardTitle>
                <CardDescription>
                  Add team members to collaborate on campaigns
                </CardDescription>
              </div>
              {!showAddForm && (
                <Button
                  variant="outline"
                  onClick={() => setShowAddForm(true)}
                  data-testid="button-add-team-member"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showAddForm && (
              <form onSubmit={handleAddMember} className="border rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="member-name">Name</Label>
                    <Input
                      id="member-name"
                      placeholder="Full name"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      data-testid="input-member-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="member-email">Email</Label>
                    <Input
                      id="member-email"
                      type="email"
                      placeholder="email@example.com"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      data-testid="input-member-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="member-role">Role (optional)</Label>
                    <Input
                      id="member-role"
                      placeholder="e.g. Manager, Analyst"
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value)}
                      data-testid="input-member-role"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddForm(false)}
                    data-testid="button-cancel-add-member"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addMember.isPending}
                    data-testid="button-save-member"
                  >
                    {addMember.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Add Member
                  </Button>
                </div>
              </form>
            )}

            {membersLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : teamMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No team members yet</p>
                <p className="text-sm">Add team members to collaborate on campaigns</p>
              </div>
            ) : (
              <div className="space-y-2">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`team-member-${member.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {member.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                      {member.role && (
                        <Badge variant="secondary" className="ml-2">
                          {member.role}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMember.mutate(member.id)}
                      disabled={removeMember.isPending}
                      data-testid={`button-remove-member-${member.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Workspace Invitations - Dynamic workspace ID */}
        {workspace && <WorkspaceInvites workspaceId={workspace.id} />}
      </div>
    </div>
  );
}
