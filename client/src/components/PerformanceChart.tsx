import { Card } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface PerformanceDataPoint {
  date: string;
  conversions: number;
  clicks: number;
}

interface PerformanceChartProps {
  data: PerformanceDataPoint[];
  title?: string;
}

export default function PerformanceChart({
  data,
  title = "Performance Trend",
}: PerformanceChartProps) {
  return (
    <Card className="p-6" data-testid="chart-performance-trend">
      <h3 className="mb-4 text-lg font-medium">{title}</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
                color: "hsl(var(--popover-foreground))",
              }}
              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
            />
            <Legend
              wrapperStyle={{ paddingTop: "1rem" }}
              iconType="circle"
            />
            <Line
              type="monotone"
              dataKey="conversions"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--chart-1))", strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6 }}
              name="Conversions"
            />
            <Line
              type="monotone"
              dataKey="clicks"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--chart-2))", strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6 }}
              name="Clicks"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
