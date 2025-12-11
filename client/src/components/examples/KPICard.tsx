import KPICard from "../KPICard";
import { DollarSign, Users, Target, CheckCircle } from "lucide-react";

export default function KPICardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <KPICard
        label="ROI"
        value={142.5}
        suffix="%"
        trend={12.3}
        icon={<DollarSign className="h-5 w-5" />}
      />
      <KPICard
        label="Cost Per Acquisition"
        value={2.45}
        prefix="$"
        trend={-8.2}
        icon={<Target className="h-5 w-5" />}
      />
      <KPICard
        label="Engaged Users"
        value={10800}
        trend={24.1}
        icon={<Users className="h-5 w-5" />}
      />
      <KPICard
        label="Content Completion"
        value={60}
        suffix="%"
        trend={0}
        icon={<CheckCircle className="h-5 w-5" />}
      />
    </div>
  );
}
