import { useEffect, useState } from 'react';
import { useLocation, useRoute, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function InviteAccept() {
  const [, params] = useRoute('/invite');
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Extract token from URL query params
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const inviteToken = searchParams.get('token');

    if (inviteToken) {
      setToken(inviteToken);
      // Save token to localStorage in case user needs to login/signup first
      localStorage.setItem('pendingInviteToken', inviteToken);
    } else {
      // Check if there's a saved token from before auth
      const savedToken = localStorage.getItem('pendingInviteToken');
      if (savedToken) {
        setToken(savedToken);
      }
    }
  }, [location]);

  // Check if user is authenticated
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/auth/me');
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  const handleAccept = async () => {
    if (!token) return;

    setAccepting(true);
    try {
      const res = await apiRequest('POST', '/api/invites/accept', { token });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to accept invitation');
      }

      const data = await res.json();

      // Clear saved token
      localStorage.removeItem('pendingInviteToken');

      setAccepted(true);
      toast({
        title: 'Invitation accepted!',
        description: `You've successfully joined ${data.workspace?.name || 'the workspace'}.`,
      });

      // Redirect to dashboard after a brief delay
      setTimeout(() => {
        setLocation('/');
      }, 2000);
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to accept invitation',
        variant: 'destructive',
      });
    } finally {
      setAccepting(false);
    }
  };

  // If not authenticated, redirect to login with return URL
  useEffect(() => {
    if (!userLoading && !user && token) {
      // Save the current path to return after login
      localStorage.setItem('authRedirect', `/invite?token=${token}`);
      setLocation('/auth');
    }
  }, [user, userLoading, token, setLocation]);

  // Loading state
  if (userLoading || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <Card className="p-8 max-w-md w-full text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-xl font-semibold mb-2">Loading invitation...</h2>
          <p className="text-muted-foreground">Please wait while we verify your invitation.</p>
        </Card>
      </div>
    );
  }

  // Success state
  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <Card className="p-8 max-w-md w-full text-center">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Invitation Accepted!</h1>
          <p className="text-muted-foreground mb-6">
            You've successfully joined the workspace. Redirecting to dashboard...
          </p>
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
        </Card>
      </div>
    );
  }

  // Invitation acceptance UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Workspace Invitation</h1>
          <p className="text-muted-foreground">
            You've been invited to join a workspace on DTTracker.
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-2">Logged in as:</p>
            <p className="font-medium">{user?.email}</p>
          </div>

          <Button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full"
            size="lg"
          >
            {accepting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Accepting...
              </>
            ) : (
              'Accept Invitation'
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By accepting, you'll be added to the workspace and can collaborate with other members.
          </p>

          <div className="pt-4 border-t">
            <Link href="/" className="text-sm text-primary hover:underline block text-center">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
