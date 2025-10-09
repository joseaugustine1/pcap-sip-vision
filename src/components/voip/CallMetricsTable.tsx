import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface CallMetricsTableProps {
  calls: any[];
}

export const CallMetricsTable = ({ calls }: CallMetricsTableProps) => {
  const getMosBadgeVariant = (mos: number | null) => {
    if (!mos) return "secondary";
    if (mos >= 4.0) return "default";
    if (mos >= 3.5) return "secondary";
    return "destructive";
  };

  const getMosColor = (mos: number | null) => {
    if (!mos) return "text-muted-foreground";
    if (mos >= 4.0) return "text-success";
    if (mos >= 3.5) return "text-warning";
    return "text-destructive";
  };

  if (calls.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No call metrics available yet</p>
        <p className="text-sm text-muted-foreground mt-1">Analysis in progress...</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Call ID</TableHead>
            <TableHead>Source IP</TableHead>
            <TableHead>Dest IP</TableHead>
            <TableHead>Codec</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Jitter (ms)</TableHead>
            <TableHead>Latency (ms)</TableHead>
            <TableHead>Packet Loss</TableHead>
            <TableHead>MOS Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call) => {
            const packetLossPercent = call.packets_sent
              ? ((call.packets_lost / call.packets_sent) * 100).toFixed(2)
              : "0.00";

            return (
              <TableRow key={call.id}>
                <TableCell className="font-mono text-xs">{call.call_id.substring(0, 8)}...</TableCell>
                <TableCell className="font-mono text-xs">{call.source_ip}</TableCell>
                <TableCell className="font-mono text-xs">{call.dest_ip}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {call.codec || "Unknown"}
                  </Badge>
                </TableCell>
                <TableCell>{call.duration?.toFixed(1)}s</TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    <div className="text-sm">{call.avg_jitter?.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">max: {call.max_jitter?.toFixed(2)}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    <div className="text-sm">{call.avg_latency?.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">max: {call.max_latency?.toFixed(2)}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    <div className="text-sm">{packetLossPercent}%</div>
                    <div className="text-xs text-muted-foreground">{call.packets_lost} lost</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getMosBadgeVariant(call.mos_score)} className={getMosColor(call.mos_score)}>
                    {call.mos_score?.toFixed(2) || "N/A"}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
