import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Briefcase,
  Building2,
  FileText,
  GitBranch,
  HelpCircle,
  Library,
  Mail,
  Megaphone,
  Newspaper,
  ScrollText,
  Server,
  ShoppingBag,
  Sparkles,
  Tags,
  Target,
  Trophy,
  User,
} from "lucide-react";

export type MegaNavBadge = "New" | "Popular";

export type MegaNavItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Brand mark image; use `iconSpriteAlign` with a vertical 2-row sprite. */
  iconSrc?: string;
  iconSpriteAlign?: "top" | "bottom";
  badge?: MegaNavBadge;
};

export type MegaNavColumn = {
  label?: string;
  items: MegaNavItem[];
};

export type MegaNavFeatured = {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
};

export type MegaNavContentLayout = "default" | "two-tiles-fill";

export type MegaNavGroup = {
  id: string;
  label: string;
  /** If set, keyboard / click can navigate (hash or path). */
  href?: string;
  featured?: MegaNavFeatured;
  columns: MegaNavColumn[];
  /** Builders: two large tiles fill the column beside featured. */
  contentLayout?: MegaNavContentLayout;
  /** Optional extra classes on the main link column (default min height is shared by all mega menus). */
  mainColumnMinClass?: string;
};

export const LANDING_MEGA_NAV: MegaNavGroup[] = [
  {
    id: "product",
    label: "Product",
    href: "#features",
    featured: {
      title: "Everything in one product",
      description:
        "Prompt Studio, workflows, and marketplace discovery — built so your AI work ships as real products.",
      href: "/marketplace",
      ctaLabel: "Explore marketplace",
    },
    columns: [
      {
        label: "Platform",
        items: [
          {
            title: "Marketplace",
            description: "Discover prompts and workflows with fast search and clean product pages.",
            href: "/marketplace",
            icon: ShoppingBag,
            badge: "Popular",
          },
          {
            title: "Workflow Studio",
            description:
              "Design visual workflows with inputs, prompts, tools, and logic—then publish.",
            href: "/builder",
            icon: GitBranch,
            iconSrc: "/brand/studio-nav-icons-sprite.png",
            iconSpriteAlign: "top",
          },
          {
            title: "Hosted runs",
            description: "How marketplace runs are billed, hosted, and surfaced.",
            href: "/docs/marketplace-fees",
            icon: Server,
          },
          {
            title: "Prompt Studio",
            description:
              "Structure prompts, versions, and inputs—publish prompt packs and single prompts.",
            href: "/prompt-studio",
            icon: Sparkles,
            iconSrc: "/brand/studio-nav-icons-sprite.png",
            iconSpriteAlign: "bottom",
          },
          {
            title: "Library",
            description: "Your saved workspace—prompts and workflows in one place.",
            href: "/library",
            icon: Library,
          },
          {
            title: "Pricing",
            description: "Plans and how marketplace earnings are priced for creators.",
            href: "/pricing",
            icon: Tags,
          },
        ],
      },
    ],
  },
  {
    id: "builders",
    label: "Builders",
    href: "/builder",
    contentLayout: "two-tiles-fill",
    featured: {
      title: "Ship tools, not screenshots",
      description: "Publish once, share a single link, and grow distribution from the marketplace.",
      href: "/builder",
      ctaLabel: "Open Workflow Studio",
    },
    columns: [
      {
        label: "Studios",
        items: [
          {
            title: "Workflow Studio",
            description:
              "The visual builder for multi-step workflows, tools, and publish-ready pages.",
            href: "/builder",
            icon: GitBranch,
            iconSrc: "/brand/studio-nav-icons-sprite.png",
            iconSpriteAlign: "top",
            badge: "Popular",
          },
          {
            title: "Prompt Studio",
            description:
              "Templates, inputs, and versions so prompts ship like products—not screenshots.",
            href: "/prompt-studio",
            icon: Sparkles,
            iconSrc: "/brand/studio-nav-icons-sprite.png",
            iconSpriteAlign: "bottom",
          },
        ],
      },
    ],
  },
  {
    id: "resources",
    label: "Resources",
    href: "/docs",
    featured: {
      title: "Documentation hub",
      description: "Guides, references, and changelog — stay current as the product evolves.",
      href: "/docs",
      ctaLabel: "Read the docs",
    },
    columns: [
      {
        label: "Learn",
        items: [
          {
            title: "Blog",
            description: "Product updates, tutorials, and stories from the team.",
            href: "/blogs",
            icon: Newspaper,
          },
          {
            title: "Documentation",
            description: "Deep dives for builders and integrators.",
            href: "/docs",
            icon: BookOpen,
            badge: "Popular",
          },
          {
            title: "Pricing",
            description: "Transparent plans for creators and teams.",
            href: "/pricing",
            icon: Tags,
          },
          {
            title: "Changelog",
            description: "What shipped recently and what is next.",
            href: "/docs/changelog",
            icon: ScrollText,
          },
          {
            title: "Help",
            description: "FAQs, troubleshooting, and how to get unstuck.",
            href: "/help",
            icon: HelpCircle,
          },
        ],
      },
    ],
  },
  {
    id: "company",
    label: "Company",
    href: "/about#about",
    featured: {
      title: "Built for clarity",
      description: "Edgaze exists to make AI work legible, trustworthy, and easy to distribute.",
      href: "/about#about",
      ctaLabel: "About Edgaze",
    },
    columns: [
      {
        label: "Company",
        items: [
          {
            title: "About",
            description: "What we are building and why it matters.",
            href: "/about#about",
            icon: Building2,
          },
          {
            title: "Founder",
            description: "The person behind Edgaze and how to connect.",
            href: "/about#founder",
            icon: User,
          },
          {
            title: "Mission",
            description: "Principles that guide product and partnerships.",
            href: "/about#mission",
            icon: Target,
          },
        ],
      },
      {
        label: "Connect",
        items: [
          {
            title: "Contact",
            description: "Sales, press, and general inquiries.",
            href: "/contact",
            icon: Mail,
          },
          {
            title: "Careers",
            description: "Help us build the marketplace for useful AI work.",
            href: "/careers",
            icon: Briefcase,
          },
          {
            title: "Press",
            description: "Brand assets, updates, and media requests.",
            href: "/press",
            icon: Megaphone,
          },
        ],
      },
    ],
  },
  {
    id: "creators",
    label: "Creators",
    href: "/creators",
    featured: {
      title: "Creator program",
      description:
        "Earn from prompts and workflows with clean pages, codes, and marketplace reach.",
      href: "/creators",
      ctaLabel: "Become a creator",
    },
    columns: [
      {
        label: "Creators",
        items: [
          {
            title: "Creator program",
            description: "Apply, publish, and grow with Edgaze distribution.",
            href: "/creators",
            icon: Sparkles,
            badge: "Popular",
          },
          {
            title: "Guidelines",
            description: "Terms, expectations, and how we keep the marketplace healthy.",
            href: "/docs/creator-terms",
            icon: FileText,
          },
          {
            title: "Success stories",
            description: "Creators shipping real revenue and reach.",
            href: "/blogs",
            icon: Trophy,
          },
        ],
      },
    ],
  },
];
