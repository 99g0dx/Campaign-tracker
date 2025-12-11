import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  type DocumentData,
} from "firebase/firestore";
import { type User, onAuthStateChanged } from "firebase/auth";
import { db, auth, signInAnonymouslyIfNeeded, isFirebaseConfigured } from "@/lib/firebase";
import type { Campaign } from "@/components/CampaignTable";
import type { EditingTask } from "@/components/EditingTaskCard";

// Firestore document interfaces
interface CampaignDoc {
  name: string;
  channel: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  engagementRate: number;
  createdAt: Timestamp;
}

interface EditingTaskDoc {
  title: string;
  campaignName: string;
  assignee: string;
  status: string;
  dueDate: Timestamp;
  createdAt: Timestamp;
}

// Sample data for seeding
const sampleCampaigns: Omit<CampaignDoc, "createdAt">[] = [
  {
    name: "Kah-Lo - Somersaults TikTok Push",
    channel: "TikTok",
    status: "Active",
    spend: 500,
    impressions: 120000,
    clicks: 15000,
    conversions: 1200,
    revenue: 2200,
    engagementRate: 14,
  },
  {
    name: "Rema Fan Edit Challenge",
    channel: "Instagram",
    status: "Active",
    spend: 800,
    impressions: 200000,
    clicks: 24000,
    conversions: 1800,
    revenue: 4100,
    engagementRate: 18,
  },
  {
    name: "Brand UGC Influencer Sprint",
    channel: "YouTube",
    status: "Completed",
    spend: 1200,
    impressions: 300000,
    clicks: 35000,
    conversions: 3000,
    revenue: 6800,
    engagementRate: 16,
  },
];

const sampleTasks: Omit<EditingTaskDoc, "createdAt" | "dueDate">[] = [
  {
    title: "Somersaults TikTok Edit v1",
    campaignName: "Kah-Lo - Somersaults TikTok Push",
    assignee: "Tomi",
    status: "Editing",
  },
  {
    title: "Rema Challenge Overlay Pack",
    campaignName: "Rema Fan Edit Challenge",
    assignee: "Ada",
    status: "In Review",
  },
  {
    title: "UGC Script Refine",
    campaignName: "Brand UGC Influencer Sprint",
    assignee: "Emeka",
    status: "Approved",
  },
  {
    title: "Instagram Reels Cutdown",
    campaignName: "Rema Fan Edit Challenge",
    assignee: "Daye",
    status: "Briefing",
  },
  {
    title: "YouTube Thumbnail Concepts",
    campaignName: "Brand UGC Influencer Sprint",
    assignee: "Zee",
    status: "Blocked",
  },
];

// Convert Firestore doc to Campaign type - compute ROI/CPA on read
function docToCampaign(id: string, data: DocumentData): Campaign {
  const spend = Number(data.spend || 0);
  const revenue = Number(data.revenue || 0);
  const conversions = Number(data.conversions || 0);

  return {
    id,
    name: data.name || "",
    channel: data.channel || "",
    status: data.status || "Draft",
    spend,
    impressions: Number(data.impressions || 0),
    clicks: Number(data.clicks || 0),
    conversions,
    cpa: conversions > 0 ? spend / conversions : 0,
    roi: spend > 0 ? ((revenue - spend) / spend) * 100 : 0,
    engagementRate: Number(data.engagementRate || 0),
  };
}

// Convert Firestore doc to EditingTask type - keep raw Date for overdue detection
function docToEditingTask(id: string, data: DocumentData): EditingTask {
  const dueDateRaw = data.dueDate?.toDate?.() || new Date();
  return {
    id,
    title: data.title || "",
    campaignName: data.campaignName || "",
    assignee: data.assignee || "",
    status: data.status || "Briefing",
    dueDate: dueDateRaw, // Return raw Date object for proper comparisons
  };
}

export function useFirebase() {
  const [user, setUser] = useState<User | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [editingTasks, setEditingTasks] = useState<EditingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const seededRef = useRef(false);

  // Check configuration on mount
  useEffect(() => {
    const configured = isFirebaseConfigured();
    setIsConfigured(configured);
    if (!configured) {
      setLoading(false);
    }
  }, []);

  // Seed data if collections are empty
  const seedDataIfEmpty = useCallback(async () => {
    if (!isConfigured || seededRef.current) return;
    seededRef.current = true;

    try {
      const campaignsSnap = await getDocs(collection(db, "campaigns"));
      const tasksSnap = await getDocs(collection(db, "editingTasks"));

      const now = new Date();
      const daysAgo = (days: number) =>
        Timestamp.fromDate(new Date(now.getTime() - days * 86400000));
      const daysAhead = (days: number) =>
        Timestamp.fromDate(new Date(now.getTime() + days * 86400000));

      if (campaignsSnap.empty) {
        console.log("Seeding campaigns collection...");
        for (let i = 0; i < sampleCampaigns.length; i++) {
          await addDoc(collection(db, "campaigns"), {
            ...sampleCampaigns[i],
            createdAt: daysAgo(6 - i * 2),
          });
        }
      }

      if (tasksSnap.empty) {
        console.log("Seeding editingTasks collection...");
        for (let i = 0; i < sampleTasks.length; i++) {
          await addDoc(collection(db, "editingTasks"), {
            ...sampleTasks[i],
            dueDate: daysAhead(i + 1),
            createdAt: Timestamp.fromDate(now),
          });
        }
      }
    } catch (err) {
      console.error("Seeding error:", err);
    }
  }, [isConfigured]);

  // Authentication - runs only when configured
  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        try {
          const newUser = await signInAnonymouslyIfNeeded();
          setUser(newUser);
        } catch (err) {
          console.error("Auth error:", err);
          setError("Failed to authenticate. Please refresh the page.");
          setLoading(false);
        }
      } else {
        setUser(currentUser);
      }
    });

    return () => unsubscribe();
  }, [isConfigured]);

  // Real-time data subscriptions - runs after user is authenticated
  useEffect(() => {
    if (!user || !isConfigured) return;

    let unsubCampaigns: (() => void) | undefined;
    let unsubTasks: (() => void) | undefined;
    let isMounted = true;

    const init = async () => {
      try {
        // Seed data first, then subscribe
        await seedDataIfEmpty();

        if (!isMounted) return;

        // Subscribe to campaigns
        const campaignsQuery = query(
          collection(db, "campaigns"),
          orderBy("createdAt", "desc")
        );
        unsubCampaigns = onSnapshot(
          campaignsQuery,
          (snapshot) => {
            if (!isMounted) return;
            const docs = snapshot.docs.map((doc) =>
              docToCampaign(doc.id, doc.data())
            );
            setCampaigns(docs);
            setLoading(false);
          },
          (err) => {
            console.error("Campaigns snapshot error:", err);
            if (isMounted) {
              setError("Failed to load campaigns. Please check your connection.");
              setLoading(false);
            }
          }
        );

        // Subscribe to editing tasks
        const tasksQuery = query(
          collection(db, "editingTasks"),
          orderBy("dueDate", "asc")
        );
        unsubTasks = onSnapshot(
          tasksQuery,
          (snapshot) => {
            if (!isMounted) return;
            const docs = snapshot.docs.map((doc) =>
              docToEditingTask(doc.id, doc.data())
            );
            setEditingTasks(docs);
          },
          (err) => {
            console.error("Tasks snapshot error:", err);
          }
        );
      } catch (err) {
        console.error("Init error:", err);
        if (isMounted) {
          setError("Failed to initialize. Please refresh the page.");
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      unsubCampaigns?.();
      unsubTasks?.();
    };
  }, [user, isConfigured, seedDataIfEmpty]);

  // Add new campaign - includes createdAt timestamp
  const addCampaign = useCallback(
    async (data: {
      name: string;
      channel: string;
      status: string;
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      revenue: number;
      engagementRate: number;
    }) => {
      if (!isConfigured) {
        throw new Error("Firebase not configured");
      }

      const campaignDoc: CampaignDoc = {
        name: data.name,
        channel: data.channel,
        status: data.status,
        spend: data.spend,
        impressions: data.impressions,
        clicks: data.clicks,
        conversions: data.conversions,
        revenue: data.revenue,
        engagementRate: data.engagementRate,
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, "campaigns"), campaignDoc);
    },
    [isConfigured]
  );

  // Add new editing task
  const addEditingTask = useCallback(
    async (data: {
      title: string;
      campaignName: string;
      assignee: string;
      status: string;
      dueDate: Date;
    }) => {
      if (!isConfigured) {
        throw new Error("Firebase not configured");
      }

      const taskDoc: EditingTaskDoc = {
        title: data.title,
        campaignName: data.campaignName,
        assignee: data.assignee,
        status: data.status,
        dueDate: Timestamp.fromDate(data.dueDate),
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, "editingTasks"), taskDoc);
    },
    [isConfigured]
  );

  return {
    user,
    campaigns,
    editingTasks,
    loading,
    error,
    isConfigured,
    addCampaign,
    addEditingTask,
  };
}
