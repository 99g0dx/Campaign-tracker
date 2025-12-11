import EditingTaskCard, { type EditingTask } from "../EditingTaskCard";

// todo: remove mock functionality
const now = new Date();
const daysAhead = (days: number) => new Date(now.getTime() + days * 86400000);
const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000);

const mockTasks: EditingTask[] = [
  {
    id: "1",
    title: "Somersaults TikTok Edit v1",
    campaignName: "Kah-Lo - Somersaults TikTok Push",
    assignee: "Tomi",
    status: "Editing",
    dueDate: daysAhead(1),
  },
  {
    id: "2",
    title: "Rema Challenge Overlay Pack",
    campaignName: "Rema Fan Edit Challenge",
    assignee: "Ada",
    status: "In Review",
    dueDate: daysAhead(2),
  },
  {
    id: "3",
    title: "UGC Script Refine",
    campaignName: "Brand UGC Influencer Sprint",
    assignee: "Emeka",
    status: "Approved",
    dueDate: daysAgo(1),
  },
  {
    id: "4",
    title: "Instagram Reels Cutdown",
    campaignName: "Rema Fan Edit Challenge",
    assignee: "Daye",
    status: "Briefing",
    dueDate: daysAhead(3),
  },
  {
    id: "5",
    title: "YouTube Thumbnail Concepts",
    campaignName: "Brand UGC Influencer Sprint",
    assignee: "Zee",
    status: "Blocked",
    dueDate: daysAgo(2),
  },
];

export default function EditingTaskCardExample() {
  const handleClick = (task: EditingTask) => {
    console.log("Task clicked:", task.title);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {mockTasks.map((task) => (
        <EditingTaskCard key={task.id} task={task} onClick={handleClick} />
      ))}
    </div>
  );
}
