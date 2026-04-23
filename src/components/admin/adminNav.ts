import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  FileText,
  Mail,
  PlayCircle,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const ADMIN_NAV_ITEMS: ReadonlyArray<AdminNavItem> = [
  { href: "/admin/moderation", label: "Moderation", icon: Shield },
  { href: "/admin/trending", label: "Trending", icon: TrendingUp },
  { href: "/admin/affiliate-links", label: "Affiliates", icon: BarChart3 },
  { href: "/admin/accounting", label: "Accounting", icon: FileText },
  { href: "/admin/runs", label: "Runs", icon: PlayCircle },
  { href: "/admin/traces", label: "Traces", icon: Activity },
  { href: "/admin/creators", label: "Creators", icon: Users },
  { href: "/admin/verified-creators", label: "Verified", icon: BadgeCheck },
  { href: "/admin/invites", label: "Invites", icon: Mail },
  { href: "/admin/demo", label: "Demo mode", icon: Sparkles },
];
