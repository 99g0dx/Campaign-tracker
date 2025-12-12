import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Music, Loader2, AlertCircle } from "lucide-react";

const COUNTRY_CODES = [
  { code: "+1", country: "US/CA", flag: "US" },
  { code: "+44", country: "UK", flag: "GB" },
  { code: "+33", country: "France", flag: "FR" },
  { code: "+49", country: "Germany", flag: "DE" },
  { code: "+39", country: "Italy", flag: "IT" },
  { code: "+34", country: "Spain", flag: "ES" },
  { code: "+31", country: "Netherlands", flag: "NL" },
  { code: "+32", country: "Belgium", flag: "BE" },
  { code: "+41", country: "Switzerland", flag: "CH" },
  { code: "+43", country: "Austria", flag: "AT" },
  { code: "+46", country: "Sweden", flag: "SE" },
  { code: "+47", country: "Norway", flag: "NO" },
  { code: "+45", country: "Denmark", flag: "DK" },
  { code: "+358", country: "Finland", flag: "FI" },
  { code: "+48", country: "Poland", flag: "PL" },
  { code: "+351", country: "Portugal", flag: "PT" },
  { code: "+353", country: "Ireland", flag: "IE" },
  { code: "+61", country: "Australia", flag: "AU" },
  { code: "+64", country: "New Zealand", flag: "NZ" },
  { code: "+81", country: "Japan", flag: "JP" },
  { code: "+82", country: "South Korea", flag: "KR" },
  { code: "+86", country: "China", flag: "CN" },
  { code: "+91", country: "India", flag: "IN" },
  { code: "+65", country: "Singapore", flag: "SG" },
  { code: "+852", country: "Hong Kong", flag: "HK" },
  { code: "+55", country: "Brazil", flag: "BR" },
  { code: "+52", country: "Mexico", flag: "MX" },
  { code: "+54", country: "Argentina", flag: "AR" },
  { code: "+27", country: "South Africa", flag: "ZA" },
  { code: "+971", country: "UAE", flag: "AE" },
  { code: "+966", country: "Saudi Arabia", flag: "SA" },
  { code: "+972", country: "Israel", flag: "IL" },
  { code: "+7", country: "Russia", flag: "RU" },
  { code: "+90", country: "Turkey", flag: "TR" },
  { code: "+62", country: "Indonesia", flag: "ID" },
  { code: "+60", country: "Malaysia", flag: "MY" },
  { code: "+63", country: "Philippines", flag: "PH" },
  { code: "+66", country: "Thailand", flag: "TH" },
  { code: "+84", country: "Vietnam", flag: "VN" },
];

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { signup, signupPending } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }

    if (!password) {
      setError("Please enter a password");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const result = await signup({
        email: email.trim(),
        password,
        fullName: fullName.trim() || undefined,
        phone: phoneNumber.trim() ? `${countryCode} ${phoneNumber.trim()}` : undefined,
      });
      if (result.ok) {
        toast({
          title: "Account created",
          description: "Please check your email for a verification code",
        });
        setLocation("/verify");
      }
    } catch (err: any) {
      const message = err?.message || "Failed to create account";
      setError(message);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Music className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Create an account</CardTitle>
          <CardDescription>
            Start tracking your song marketing campaigns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                data-testid="input-full-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <div className="flex gap-2">
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger className="w-[100px]" data-testid="select-country-code">
                    <SelectValue placeholder="Code" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CODES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.code} {country.country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  autoComplete="tel"
                  className="flex-1"
                  data-testid="input-phone"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                data-testid="input-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                data-testid="input-confirm-password"
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
              disabled={signupPending}
              data-testid="button-signup"
            >
              {signupPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {signupPending ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline" data-testid="link-login">
              Log in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
