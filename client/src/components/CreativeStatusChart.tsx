import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface StatusDataPoint {
  name: string;
  value: number;
}

interface CreativeStatusChartProps {
  data: StatusDataPoint[];
  title?: string;
}

const STATUS_COLORS: Record<string, string> = {
  Approved: "#22c55e",
  "In Review": "#eab308",
  Editing: "#3b82f6",
  Briefing: "#a855f7",
  Blocked: "#ef4444",
};

export default function CreativeStatusChart({
  data,
  title = "Creative Production Status",
}: CreativeStatusChartProps) {
  return (
    <Card className="p-6" data-testid="chart-creative-status">
      <h3 className="mb-4 text-lg font-medium">{title}</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={STATUS_COLORS[entry.name] || "#6b7280"}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
                color: "hsl(var(--popover-foreground))",
              }}
              formatter={(value: number) => [value, "Tasks"]}
            />
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span style={{ color: "hsl(var(--foreground))", fontSize: "12px" }}>
                  {value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
