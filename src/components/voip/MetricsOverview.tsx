import { Card } from "@/components/ui/card";
import { Activity, Clock, TrendingUp, Phone } from "lucide-react";

interface MetricsOverviewProps {
  session: any;
  calls: any[];
}

export const MetricsOverview = ({ session, calls }: MetricsOverviewProps) => {
  const getMosColor = (mos: number | null) => {
    if (!mos) return "text-muted-foreground";
    if (mos >= 4.0) return "text-success";
    if (mos >= 3.5) return "text-warning";
    return "text-destructive";
  };

  const metrics = [
    {
      title: "Total Calls",
      value: calls.length,
      icon: Phone,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Average MOS",
      value: session.avg_mos?.toFixed(2) || "N/A",
      icon: Activity,
      color: getMosColor(session.avg_mos),
      bgColor: "bg-accent/10",
      description: session.avg_mos >= 4.0 ? "Excellent" : session.avg_mos >= 3.5 ? "Good" : "Poor",
    },
    {
      title: "Avg Jitter",
      value: session.avg_jitter ? `${session.avg_jitter.toFixed(2)} ms` : "N/A",
      icon: TrendingUp,
      color: "text-chart-3",
      bgColor: "bg-warning/10",
    },
    {
      title: "Avg Latency",
      value: session.avg_latency ? `${session.avg_latency.toFixed(2)} ms` : "N/A",
      icon: Clock,
      color: "text-chart-4",
      bgColor: "bg-chart-4/10",
    },
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => (
        <Card key={index} className="p-6 bg-card border-border hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">{metric.title}</p>
              <p className={`text-3xl font-bold ${metric.color}`}>{metric.value}</p>
              {metric.description && (
                <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
              )}
            </div>
            <div className={`p-3 rounded-lg ${metric.bgColor}`}>
              <metric.icon className={`w-5 h-5 ${metric.color}`} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
