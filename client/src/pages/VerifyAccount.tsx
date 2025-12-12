import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Mail, Loader2, AlertCircle } from "lucide-react";

export default function VerifyAccount() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { verify, verifyPending, resendCode, resendCodePending, user } = useAuth();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (code.length !== 6) {
      setError("Please enter the 6-digit verification code");
      return;
    }

    try {
      const result = await verify(code);
      if (result.ok) {
        toast({
          title: "Account verified",
          description: "Welcome to Campaign Tracker!",
        });
        setLocation("/dashboard");
      }
    } catch (err: any) {
      const message = err?.message || "Invalid or expired verification code";
      setError(message);
    }
  }

  async function handleResend() {
    try {
      await resendCode();
      toast({
        title: "Code sent",
        description: "A new verification code has been sent to your email",
      });
    } catch (err: any) {
      toast({
        title: "Failed to resend",
        description: err?.message || "Could not resend verification code",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Verify your email</CardTitle>
          <CardDescription>
            {user?.email ? (
              <>We sent a 6-digit verification code to <strong>{user.email}</strong></>
            ) : (
              "Enter the 6-digit code we sent to your email"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-2xl tracking-widest"
                maxLength={6}
                data-testid="input-verification-code"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={verifyPending || code.length !== 6}
              data-testid="button-verify"
            >
              {verifyPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {verifyPending ? "Verifying..." : "Verify Account"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              onClick={handleResend}
              disabled={resendCodePending}
              data-testid="button-resend-code"
            >
              {resendCodePending ? "Sending..." : "Resend code"}
            </Button>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Check your email inbox and spam folder for the verification code.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
