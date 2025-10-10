import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Activity, Loader2, Terminal } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            display_name: displayName || email.split("@")[0],
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Account Created",
        description: "Welcome to VoIP Analyzer! Redirecting...",
      });
    } catch (error: any) {
      toast({
        title: "Sign Up Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo/Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-primary/30">
            <Terminal className="w-6 h-6 text-primary animate-pulse" />
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground font-mono">
            VoIP <span className="text-primary">Analyzer</span>
          </h1>
          <p className="text-sm text-muted-foreground font-mono">
            {'>'} PCAP Analysis & Network Troubleshooting
          </p>
        </div>

        <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin" className="font-mono">
                SIGN IN
              </TabsTrigger>
              <TabsTrigger value="signup" className="font-mono">
                SIGN UP
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="font-mono text-xs text-primary">
                    EMAIL_ADDRESS
                  </Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="user@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                    className="font-mono text-sm bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signin-password" className="font-mono text-xs text-primary">
                    PASSWORD
                  </Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    className="font-mono text-sm bg-background/50"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full font-mono"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      AUTHENTICATING...
                    </>
                  ) : (
                    ">> LOGIN"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="font-mono text-xs text-primary">
                    DISPLAY_NAME
                  </Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Your display name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={loading}
                    className="font-mono text-sm bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="font-mono text-xs text-primary">
                    EMAIL_ADDRESS
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="user@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                    className="font-mono text-sm bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="font-mono text-xs text-primary">
                    PASSWORD
                  </Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    minLength={6}
                    className="font-mono text-sm bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground font-mono">
                    # Min 6 characters
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full font-mono"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      CREATING_ACCOUNT...
                    </>
                  ) : (
                    ">> CREATE ACCOUNT"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-center text-muted-foreground font-mono">
              # Secure authentication powered by end-to-end encryption
            </p>
          </div>
        </Card>

        <div className="text-center">
          <p className="text-xs text-muted-foreground font-mono">
            {'>'} System Status: <span className="text-success">ONLINE</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
