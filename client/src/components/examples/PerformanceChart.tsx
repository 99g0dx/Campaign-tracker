import PerformanceChart from "../PerformanceChart";

// todo: remove mock functionality
const mockPerformanceData = [
  { date: "Dec 5", conversions: 800, clicks: 12000 },
  { date: "Dec 6", conversions: 1200, clicks: 15000 },
  { date: "Dec 7", conversions: 1800, clicks: 24000 },
  { date: "Dec 8", conversions: 2200, clicks: 28000 },
  { date: "Dec 9", conversions: 3000, clicks: 35000 },
  { date: "Dec 10", conversions: 4500, clicks: 42000 },
  { date: "Dec 11", conversions: 6000, clicks: 50000 },
];

export default function PerformanceChartExample() {
  return <PerformanceChart data={mockPerformanceData} title="7-Day Performance Trend" />;
}
