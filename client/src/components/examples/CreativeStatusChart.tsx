import CreativeStatusChart from "../CreativeStatusChart";

// todo: remove mock functionality
const mockStatusData = [
  { name: "Approved", value: 3 },
  { name: "In Review", value: 4 },
  { name: "Editing", value: 5 },
  { name: "Briefing", value: 2 },
  { name: "Blocked", value: 1 },
];

export default function CreativeStatusChartExample() {
  return <CreativeStatusChart data={mockStatusData} />;
}
