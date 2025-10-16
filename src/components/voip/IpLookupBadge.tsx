import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe } from "lucide-react";

interface IpLookupBadgeProps {
  ip: string;
}

interface IpInfo {
  country?: string;
  city?: string;
  isp?: string;
  org?: string;
  isPrivate?: boolean;
}

export const IpLookupBadge = ({ ip }: IpLookupBadgeProps) => {
  const [ipInfo, setIpInfo] = useState<IpInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    lookupIp();
  }, [ip]);

  const lookupIp = async () => {
    try {
      setLoading(true);
      
      const data = await apiClient.lookupIp(ip);
      setIpInfo(data);
    } catch (error) {
      console.error("IP lookup error:", error);
      setIpInfo(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
        <Loader2 className="w-3 h-3 animate-spin" />
      </span>
    );
  }

  if (!ipInfo || ipInfo.isPrivate) {
    return null;
  }

  const parts = [];
  if (ipInfo.org) parts.push(ipInfo.org);
  else if (ipInfo.isp) parts.push(ipInfo.isp);
  if (ipInfo.city) parts.push(ipInfo.city);
  if (ipInfo.country) parts.push(ipInfo.country);

  if (parts.length === 0) return null;

  return (
    <Badge variant="outline" className="text-[9px] font-mono bg-accent/10 border-accent/30 text-accent-foreground">
      <Globe className="w-2.5 h-2.5 mr-1" />
      {parts.join(", ")}
    </Badge>
  );
};
