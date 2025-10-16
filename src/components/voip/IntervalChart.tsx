import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface IntervalChartProps {
  sessionId: string;
}

export const IntervalChart = ({ sessionId }: IntervalChartProps) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIntervalData();
  }, [sessionId]);

  const loadIntervalData = async () => {
    try {
      setLoading(true);

      // Get all calls for this session
      const calls = await apiClient.getCallMetrics(sessionId);

      if (calls && calls.length > 0) {
        const callIds = calls.map((c: any) => c.id);

        // Get interval metrics for each call
        const allIntervals = [];
        for (const callId of callIds) {
          const intervals = await apiClient.getIntervalMetrics(callId);
          allIntervals.push(...intervals);
        }

        const formattedData = allIntervals.map((interval: any) => ({
          time: format(new Date(interval.interval_start), "HH:mm:ss"),
          jitter: interval.jitter ? Number(interval.jitter) : 0,
          latency: interval.latency ? Number(interval.latency) : 0,
          mos: interval.mos_score ? Number(interval.mos_score) : 0,
          packetLoss: interval.packet_loss ? Number(interval.packet_loss) : 0,
        })) || [];

        setData(formattedData);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error("Error loading interval data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No interval data available yet</p>
        <p className="text-sm text-muted-foreground mt-1">Analysis in progress...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-4">MOS Score Over Time</h4>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" style={{ fontSize: 12 }} />
            <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: 12 }} domain={[0, 5]} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="mos" stroke="hsl(var(--chart-2))" strokeWidth={2} name="MOS Score" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-foreground mb-4">Jitter & Latency</h4>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" style={{ fontSize: 12 }} />
            <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="jitter" stroke="hsl(var(--chart-3))" strokeWidth={2} name="Jitter (ms)" />
            <Line type="monotone" dataKey="latency" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Latency (ms)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-foreground mb-4">Packet Loss</h4>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" style={{ fontSize: 12 }} />
            <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="packetLoss" stroke="hsl(var(--destructive))" strokeWidth={2} name="Packet Loss %" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
