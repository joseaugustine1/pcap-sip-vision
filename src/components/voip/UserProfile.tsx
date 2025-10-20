import { useState, useEffect } from "react";
import { auth, apiClient } from "@/lib/api"; // <-- local Node API
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/use-theme";

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
}

export const UserProfile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await auth.getUser();

        if (!data.user) {
          navigate("/auth");
          return;
        }

        setUserId(data.user.id);
        setUserEmail(data.user.email ?? "");

        const profileData = await apiClient.getProfile(data.user.id);
        setProfile({
          display_name: profileData?.display_name ?? null,
          avatar_url: profileData?.avatar_url ?? null,
        });
      } catch (err) {
        console.error("Error loading profile:", err);
      }
    })();
  }, [navigate]);

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      toast({
        title: "Logged Out",
        description: "Successfully signed out",
      });
      navigate("/auth");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message ?? "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  const displayName =
    profile?.display_name || (userEmail ? userEmail.split("@")[0] : "User");
  const initials = displayName.substring(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 w-10 rounded-full border border-primary/30"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={profile?.avatar_url || undefined}
              alt={displayName}
            />
            <AvatarFallback className="bg-primary/20 text-primary font-mono">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-56 bg-card border-primary/20"
      >
        <DropdownMenuLabel className="font-mono">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium text-primary">{displayName}</p>
            <p className="text-xs text-muted-foreground">{userEmail}</p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-border" />

        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="font-mono text-xs cursor-pointer"
        >
          <Sun className="mr-2 h-4 w-4" />
          <span>Light Mode</span>
          {theme === "light" && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="font-mono text-xs cursor-pointer"
        >
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark Mode</span>
          {theme === "dark" && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-border" />

        <DropdownMenuItem
          onClick={handleSignOut}
          className="font-mono text-xs"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>LOGOUT</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
