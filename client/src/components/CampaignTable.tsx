import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Campaign {
  id: number;
  name: string;
  channel: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number;
  roi: number;
  engagementRate: number;
}

interface CampaignTableProps {
  campaigns: Campaign[];
  onCampaignClick?: (campaign: Campaign) => void;
}

type SortKey = keyof Campaign;

export default function CampaignTable({ campaigns, onCampaignClick }: CampaignTableProps) {
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filteredCampaigns = campaigns
    .filter((c) => {
      const matchesText =
        c.name.toLowerCase().includes(filterText.toLowerCase()) ||
        c.channel.toLowerCase().includes(filterText.toLowerCase());
      const matchesStatus = statusFilter === "All" || c.status === statusFilter;
      return matchesText && matchesStatus;
    })
    .sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

  const getStatusVariant = (status: Campaign["status"]) => {
    switch (status) {
      case "Active":
        return "default";
      case "Completed":
        return "secondary";
      case "Paused":
        return "outline";
      case "Draft":
        return "outline";
      default:
        return "outline";
    }
  };

  const formatCurrency = (value: number) => `$${value.toLocaleString()}`;
  const formatNumber = (value: number) => value.toLocaleString();
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  return (
    <Card className="p-6" data-testid="table-campaigns">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-medium">Campaign Overview</h3>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search campaigns..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-9"
              data-testid="input-search-campaigns"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Paused">Paused</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1">
                  Campaign
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort("spend")}
              >
                <div className="flex items-center justify-end gap-1">
                  Spend
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-right">Impressions</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort("conversions")}
              >
                <div className="flex items-center justify-end gap-1">
                  Conversions
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-right">CPA</TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort("roi")}
              >
                <div className="flex items-center justify-end gap-1">
                  ROI
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead className="text-right">Engagement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCampaigns.map((campaign) => (
              <TableRow
                key={campaign.id}
                className={cn(
                  "hover-elevate cursor-pointer",
                  onCampaignClick && "active-elevate-2"
                )}
                onClick={() => onCampaignClick?.(campaign)}
                data-testid={`row-campaign-${campaign.id}`}
              >
                <TableCell className="font-medium">{campaign.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {campaign.channel}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(campaign.status)}>
                    {campaign.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatCurrency(campaign.spend)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatNumber(campaign.impressions)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatNumber(campaign.clicks)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatNumber(campaign.conversions)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatCurrency(campaign.cpa)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono text-sm font-medium",
                    campaign.roi > 0 ? "text-emerald-500" : "text-red-500"
                  )}
                >
                  {campaign.roi > 0 ? "+" : ""}
                  {formatPercent(campaign.roi)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatPercent(campaign.engagementRate)}
                </TableCell>
              </TableRow>
            ))}
            {filteredCampaigns.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                  No campaigns found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
