import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Music, 
  BarChart3, 
  Users, 
  TrendingUp,
  Zap,
  Shield,
} from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Campaign Tracker</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/api/login">
              <Button data-testid="button-login">Log In</Button>
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Track Your Song Marketing Campaigns
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Monitor social media engagement across TikTok, Instagram, YouTube and more. 
              Get real-time analytics to measure your music promotion success.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/api/login">
                <Button size="lg" data-testid="button-get-started">
                  Get Started Free
                </Button>
              </a>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl font-bold text-center mb-12">
              Everything You Need to Track Campaign Performance
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="rounded-md bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Real-time Analytics</h3>
                  <p className="text-muted-foreground">
                    Track views, likes, comments, and shares across all your social media posts in one dashboard.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="rounded-md bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Creator Management</h3>
                  <p className="text-muted-foreground">
                    Organize creators by campaign and track their workflow status from briefing to completion.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="rounded-md bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Engagement Trends</h3>
                  <p className="text-muted-foreground">
                    Visualize performance over time with interactive charts showing engagement growth.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-6">
                  Supported Platforms
                </h2>
                <p className="text-muted-foreground mb-6">
                  Automatically scrape engagement data from the most popular social media platforms where music goes viral.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-primary" />
                    <span>TikTok - Automatic engagement scraping</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-primary" />
                    <span>Instagram - Reels and posts tracking</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-primary" />
                    <span>YouTube - Video performance metrics</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <span className="text-muted-foreground">Twitter/X and Facebook - Manual entry</span>
                  </li>
                </ul>
              </div>
              <div className="bg-muted/30 rounded-lg p-8 text-center">
                <Music className="h-16 w-16 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Ready to Launch?</h3>
                <p className="text-muted-foreground mb-6">
                  Start tracking your song marketing campaigns today.
                </p>
                <a href="/api/login">
                  <Button size="lg" data-testid="button-start-tracking">
                    Start Tracking
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-4">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>Campaign Tracker - Song Marketing Dashboard</p>
        </div>
      </footer>
    </div>
  );
}
