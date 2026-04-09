import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeCheck,
  FileText,
  Mail,
  PlayCircle,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const ADMIN_NAV_ITEMS: ReadonlyArray<AdminNavItem> = [
  { href: "/admin/moderation", label: "Moderation", icon: Shield },
  { href: "/admin/accounting", label: "Accounting", icon: FileText },
  { href: "/admin/runs", label: "Runs", icon: PlayCircle },
  { href: "/admin/traces", label: "Traces", icon: Activity },
  { href: "/admin/creators", label: "Creators", icon: Users },
  { href: "/admin/verified-creators", label: "Verified", icon: BadgeCheck },
  { href: "/admin/invites", label: "Invites", icon: Mail },
  { href: "/admin/demo", label: "Demo mode", icon: Sparkles },
];
