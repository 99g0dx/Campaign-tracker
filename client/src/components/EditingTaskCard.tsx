import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EditingTask {
  id: string;
  title: string;
  campaignName: string;
  assignee: string;
  status: "Approved" | "In Review" | "Editing" | "Briefing" | "Blocked";
  dueDate: string;
}

interface EditingTaskCardProps {
  task: EditingTask;
  onClick?: (task: EditingTask) => void;
}

const STATUS_STYLES: Record<EditingTask["status"], { bg: string; text: string; border: string }> = {
  Approved: { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-l-emerald-500" },
  "In Review": { bg: "bg-yellow-500/10", text: "text-yellow-500", border: "border-l-yellow-500" },
  Editing: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-l-blue-500" },
  Briefing: { bg: "bg-purple-500/10", text: "text-purple-500", border: "border-l-purple-500" },
  Blocked: { bg: "bg-red-500/10", text: "text-red-500", border: "border-l-red-500" },
};

export default function EditingTaskCard({ task, onClick }: EditingTaskCardProps) {
  const statusStyle = STATUS_STYLES[task.status];
  const initials = task.assignee
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isOverdue = new Date(task.dueDate) < new Date() && task.status !== "Approved";

  return (
    <Card
      className={cn(
        "border-l-4 p-4 hover-elevate cursor-pointer",
        statusStyle.border
      )}
      onClick={() => onClick?.(task)}
      data-testid={`card-task-${task.id}`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium leading-tight">{task.title}</h4>
          <Badge className={cn(statusStyle.bg, statusStyle.text, "border-0 text-xs")}>
            {task.status}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-1">{task.campaignName}</p>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">{task.assignee}</span>
          </div>

          <div
            className={cn(
              "flex items-center gap-1 text-xs",
              isOverdue ? "text-red-500" : "text-muted-foreground"
            )}
          >
            {isOverdue ? <Clock className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
            <span>{task.dueDate}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
