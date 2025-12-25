import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Mail, Trash2, Loader2, Clock, Check } from 'lucide-react';

interface WorkspaceInvite {
  id: number;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

interface WorkspaceInvitesProps {
  workspaceId: number;
}

export function WorkspaceInvites({ workspaceId }: WorkspaceInvitesProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('viewer');

  // Fetch workspace invites
  const { data: invites = [], isLoading } = useQuery<WorkspaceInvite[]>({
    queryKey: [`/api/workspaces/${workspaceId}/invites`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/workspaces/${workspaceId}/invites`);
      if (!res.ok) throw new Error('Failed to fetch invites');
      return res.json();
    },
  });

  // Send invite mutation
  const sendInvite = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const res = await apiRequest('POST', `/api/workspaces/${workspaceId}/invite`, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to send invitation');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/invites`] });
      toast({
        title: 'Invitation sent!',
        description: `An email invitation has been sent to ${inviteEmail}`,
      });
      setInviteEmail('');
      setInviteRole('viewer');
      setShowInviteForm(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to send invitation',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Revoke invite mutation
  const revokeInvite = useMutation({
    mutationFn: async (inviteId: number) => {
      const res = await apiRequest('DELETE', `/api/invites/${inviteId}`);
      if (!res.ok) throw new Error('Failed to revoke invitation');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/invites`] });
      toast({
        title: 'Invitation revoked',
        description: 'The invitation has been revoked successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to revoke invitation',
        variant: 'destructive',
      });
    },
  });

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    sendInvite.mutate({ email: inviteEmail.trim(), role: inviteRole });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return (
          <Badge variant="default" className="bg-green-600">
            <Check className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="secondary" className="text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-primary text-primary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Workspace Invitations
          </CardTitle>
          {!showInviteForm && (
            <Button onClick={() => setShowInviteForm(true)} size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showInviteForm && (
          <form onSubmit={handleSendInvite} className="border rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger id="invite-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowInviteForm(false);
                  setInviteEmail('');
                  setInviteRole('viewer');
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={sendInvite.isPending || !inviteEmail.trim()}>
                {sendInvite.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send Invitation
              </Button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : invites.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No pending invitations</p>
            <p className="text-sm">Invite team members to collaborate on campaigns</p>
          </div>
        ) : (
          <div className="space-y-2">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{invite.email}</p>
                    {getStatusBadge(invite.status)}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>Role: {invite.role}</span>
                    <span>•</span>
                    <span>
                      {invite.status === 'accepted'
                        ? `Accepted ${new Date(invite.acceptedAt!).toLocaleDateString()}`
                        : `Expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
                    </span>
                  </div>
                </div>
                {invite.status === 'pending' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => revokeInvite.mutate(invite.id)}
                    disabled={revokeInvite.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
