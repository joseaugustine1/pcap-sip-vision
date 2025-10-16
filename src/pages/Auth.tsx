import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Activity, Loader2, Terminal } from "lucide-react";
import { z } from 'zod';
import { mapError, logError } from '@/lib/errorHandler';

const signUpSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .email({ message: 'Please enter a valid email address' })
    .max(255, { message: 'Email must be less than 255 characters' }),
  password: z.string()
    .min(8, { message: 'Password must be at least 8 characters' })
    .max(100, { message: 'Password must be less than 100 characters' })
    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
    .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number' })
    .regex(/[^A-Za-z0-9]/, { message: 'Password must contain at least one special character' }),
  displayName: z.string()
    .trim()
    .min(2, { message: 'Display name must be at least 2 characters' })
    .max(50, { message: 'Display name must be less than 50 characters' })
    .regex(
      /^[a-zA-Z0-9\s_-]+$/,
      { message: 'Display name can only contain letters, numbers, spaces, hyphens and underscores' }
    )
    .optional()
    .or(z.literal(''))
});

const signInSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .email({ message: 'Please enter a valid email address' }),
  password: z.string()
    .min(1, { message: 'Password is required' })
});

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    // Check if user is already logged in
    auth.getUser().then(({ data }) => {
      if (data.user) {
        navigate("/");
      }
    });

    const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
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
      const validated = signUpSchema.parse({
        email: email.trim().toLowerCase(),
        password,
        displayName: displayName.trim() || email.split('@')[0]
      });

      const { error } = await auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          data: {
            displayName: validated.displayName,
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Account Created",
        description: "Welcome to VoIP Analyzer! Redirecting...",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        logError('signup', error);
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        logError('signup', error);
        const { message } = mapError(error);
        toast({
          title: "Sign Up Failed",
          description: message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = signInSchema.parse({
        email: email.trim().toLowerCase(),
        password
      });

      const { error } = await auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) throw error;

      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        logError('signin', error);
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        logError('signin', error);
        const { message } = mapError(error);
        toast({
          title: "Login Failed",
          description: message,
          variant: "destructive",
        });
      }
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
                      minLength={8}
                      className="font-mono text-sm bg-background/50"
                    />
                    <p className="text-xs text-muted-foreground font-mono">
                      # Min 8 characters, must include uppercase, lowercase, number & special character
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
