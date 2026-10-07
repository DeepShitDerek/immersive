"use client";

import {
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  Clock,
  Columns,
  Github,
  GitPullRequest,
  Grid2X2,
  Grid3X3,
  Image,
  LayoutList,
  List,
  Mic,
  Quote,
  Star,
  TrendingUp,
  Trophy,
  Wrench,
  Zap,
  CircleHelp,
  ListOrdered,
} from "lucide-react";

// ─── Layout registry ──────────────────────────────────

export const LAYOUT_OPTIONS = [
  // ── existing ──
  {
    value: "default",
    label: "Default List",
    icon: List,
    group: "Basic",
    description: "Clean rows with tags and dates on the right",
  },
  {
    value: "timeline",
    label: "Timeline",
    icon: Clock,
    group: "Basic",
    description: "A git log: one branch line, a commit card per item",
  },
  {
    value: "grid-2-col",
    label: "Grid — 2 Columns",
    icon: Grid2X2,
    group: "Basic",
    description: "Two-column card grid with hover effects",
  },
  {
    value: "grid-3-col",
    label: "Grid — 3 Columns",
    icon: Grid3X3,
    group: "Basic",
    description: "Three-column compact card grid",
  },
  {
    value: "cards-with-image",
    label: "Cards with Image",
    icon: Image,
    group: "Basic",
    description: "Two-column cards with image headers",
  },
  {
    value: "compact-cards",
    label: "Compact / Chips",
    icon: LayoutList,
    group: "Basic",
    description: "Inline chip-style tags, great for tools or skills",
  },
  {
    value: "stats-grid",
    label: "Stats Grid",
    icon: BarChart3,
    group: "Basic",
    description: "Number-focused grid for metrics and achievements",
  },
  {
    value: "masonry",
    label: "Masonry",
    icon: Columns,
    group: "Basic",
    description: "Pinterest-style staggered grid with images",
  },
  {
    value: "feature-alternating",
    label: "Featured Projects",
    icon: Star,
    group: "Basic",
    description: "Large alternating layout with overlapping description",
  },
  {
    value: "github-grid",
    label: "GitHub Grid",
    icon: Github,
    group: "Basic",
    description: "Auto-fetched GitHub repository cards",
  },
  {
    value: "highlight",
    label: "Random highlight",
    icon: Quote,
    group: "Basic",
    description: "One of your public Library lines, different on each visit",
  },
  // ── must-haves ──
  {
    value: "case-study",
    label: "Case Study",
    icon: BookOpen,
    group: "Must-haves",
    description:
      "Problem → approach → outcome with hero image and outcome metrics",
  },
  {
    value: "services",
    label: "Services",
    icon: Wrench,
    group: "Must-haves",
    description: "Icon + title + description tiles for what you offer",
  },
  {
    value: "work-experience",
    label: "Work Experience",
    icon: Briefcase,
    group: "Must-haves",
    description: "Company logo, role, dates, and bullet impact lines",
  },
  {
    value: "testimonials",
    label: "Testimonials",
    icon: Quote,
    group: "Must-haves",
    description: "Attributed quotes with avatar, name, and role",
  },
  {
    value: "process",
    label: "Process",
    icon: ListOrdered,
    group: "Must-haves",
    description:
      "Numbered steps — how working with you goes (step, how long, what happens)",
  },
  {
    value: "faq",
    label: "FAQ",
    icon: CircleHelp,
    group: "Must-haves",
    description: "Questions that open to their answers; title is the question",
  },
  // ── high signal ──
  {
    value: "impact-numbers",
    label: "Impact Numbers",
    icon: TrendingUp,
    group: "High Signal",
    description: "Quantified results — big bold numbers in a seamless grid",
  },
  {
    value: "open-source",
    label: "Open Source",
    icon: GitPullRequest,
    group: "High Signal",
    description: "Repos contributed to with PR counts and star ratings",
  },
  {
    value: "speaking",
    label: "Speaking / Writing",
    icon: Mic,
    group: "High Signal",
    description: "Talks, articles, podcasts, and workshops with type badges",
  },
  // ── creative ──
  {
    value: "press-awards",
    label: "Press / Awards",
    icon: Trophy,
    group: "Creative",
    description: "Recognition strip — Awwwards, publications, accolades",
  },
  {
    value: "client-logos",
    label: "Client Logos",
    icon: Building2,
    group: "Creative",
    description: '"Worked with" logo grid, grayscale → colour on hover',
  },
  {
    value: "now-page",
    label: "Now Page",
    icon: Zap,
    group: "Creative",
    description: "What you're doing right now — work, reading, travel",
  },
  {
    value: "uses",
    label: "Uses / Setup",
    icon: Wrench,
    group: "Creative",
    description: "Tools, editor, hardware — grouped by category",
  },
];

export const LAYOUT_GROUPS = [
  "Basic",
  "Must-haves",
  "High Signal",
  "Creative",
] as const;

// ─── Mini preview renderers ────────────────────────────

export function LayoutPreview({ layout }: { layout: string }) {
  const block = "rounded bg-muted/50 border border-border/50";
  const bar = "h-2 rounded-full bg-muted-foreground/20";
  const sbar = "h-1.5 rounded-full bg-muted-foreground/15";
  const tag = "h-1.5 w-6 rounded-full bg-primary/30";
  const dot = "size-2 rounded-full bg-primary";

  switch (layout) {
    // ── existing previews ──
    case "timeline":
      return (
        <div className="space-y-2.5 border-l-2 border-primary/30 py-1 pl-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[17px] top-1.5">
                <div className={dot} />
              </div>
              <div className={`${block} space-y-1 p-2.5`}>
                <div className={`${bar} w-2/3`} />
                <div className={`${sbar} w-full`} />
                <div className="flex gap-1">
                  {[0, 1].map((j) => (
                    <div key={j} className={tag} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    case "grid-2-col":
      return (
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${block} space-y-1 p-2.5`}>
              <div className={`${bar} w-3/4`} />
              <div className={`${sbar} w-full`} />
              <div className="flex gap-1">
                {[0, 1].map((j) => (
                  <div key={j} className={tag} />
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    case "grid-3-col":
      return (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${block} space-y-1 p-2`}>
              <div className={`${bar} w-3/4`} />
              <div className={`${sbar} w-full`} />
              <div className={tag} />
            </div>
          ))}
        </div>
      );
    case "cards-with-image":
      return (
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map((i) => (
            <div key={i} className={`${block} overflow-hidden`}>
              <div className="h-9 bg-gradient-to-br from-primary/10 to-accent/10" />
              <div className="space-y-1 p-2">
                <div className={`${bar} w-2/3`} />
                <div className={`${sbar} w-full`} />
              </div>
            </div>
          ))}
        </div>
      );
    case "compact-cards":
      return (
        <div className="flex flex-wrap gap-1.5">
          {["Design", "Dev", "Strategy", "API"].map((l) => (
            <div
              key={l}
              className={`${block} px-2.5 py-1 text-[9px] text-muted-foreground`}
            >
              {l}
            </div>
          ))}
        </div>
      );
    case "stats-grid":
      return (
        <div className="grid grid-cols-4 gap-1.5">
          {["42+", "1.2k", "5yr", "∞"].map((s) => (
            <div key={s} className={`${block} p-2 text-center`}>
              <div className="text-xs font-bold text-foreground">{s}</div>
              <div className={`${sbar} mt-1 w-full`} />
            </div>
          ))}
        </div>
      );
    case "masonry":
      return (
        <div className="columns-3 gap-2">
          {[40, 28, 50, 32, 44, 36].map((h, i) => (
            <div
              key={i}
              className={`${block} mb-2 break-inside-avoid`}
              style={{ height: h }}
            >
              <div className="p-1.5">
                <div className={`${sbar} w-3/4`} />
              </div>
            </div>
          ))}
        </div>
      );
    case "feature-alternating":
      return (
        <div className="space-y-2.5">
          {[0, 1].map((i) => (
            <div
              key={i}
              className={`flex gap-2 ${i % 2 ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`${block} h-10 flex-1 bg-gradient-to-br from-primary/10 to-accent/10`}
              />
              <div className="flex-1 space-y-1 py-1">
                <div className="text-[9px] text-primary">Featured</div>
                <div className={`${bar} w-2/3`} />
                <div className={`${sbar} w-full`} />
              </div>
            </div>
          ))}
        </div>
      );
    case "highlight":
      return (
        <div className="space-y-1.5 px-1">
          <div className={`${bar} w-full`} />
          <div className={`${bar} w-4/5`} />
          <div className={`${sbar} mt-2 w-1/3`} />
        </div>
      );
    case "github-grid":
      return (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${block} space-y-1 p-2`}>
              <div className={`${bar} w-2/3`} />
              <div className={`${sbar} w-full`} />
              <div className="flex items-center gap-1">
                <div className={tag} />
                <span className="text-[8px] text-muted-foreground">★ 0</span>
              </div>
            </div>
          ))}
        </div>
      );
    case "default":
      return (
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`${block} flex items-center justify-between p-2.5`}
            >
              <div className="flex-1 space-y-1">
                <div className={`${bar} w-1/3`} />
                <div className={`${sbar} w-1/2`} />
              </div>
              <div className="flex gap-1">
                {[0, 1].map((j) => (
                  <div key={j} className={tag} />
                ))}
              </div>
            </div>
          ))}
        </div>
      );

    // ── new previews ──
    case "case-study":
      return (
        <div className="space-y-2">
          <div className="h-16 rounded border border-border/50 bg-gradient-to-br from-primary/10 to-accent/10" />
          <div className="grid grid-cols-[1fr_60px] gap-2">
            <div className="space-y-2">
              {[
                ["01", "bg-chart-1/20 text-chart-1"],
                ["02", "bg-chart-4/20 text-chart-4"],
                ["03", "bg-chart-2/20 text-chart-2"],
              ].map(([n, c]) => (
                <div key={n} className="flex items-start gap-2">
                  <span className={`rounded px-1 py-0.5 text-[8px] ${c}`}>
                    {n}
                  </span>
                  <div className="flex-1 space-y-0.5">
                    <div className={`${sbar} w-full`} />
                    <div className={`${sbar} w-3/4`} />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              {["60%", "12k", "2×"].map((v) => (
                <div key={v} className={`${block} p-1.5 text-center`}>
                  <div className="text-[10px] font-bold text-foreground">
                    {v}
                  </div>
                  <div className={`${sbar} mt-0.5 w-full`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case "services":
      return (
        <div className="grid grid-cols-3 gap-2">
          {[
            ["bg-chart-1/10", "bg-chart-1"],
            ["bg-chart-4/10", "bg-chart-4"],
            ["bg-chart-2/10", "bg-chart-2"],
          ].map(([bg, tc], i) => (
            <div key={i} className={`${block} space-y-2 p-2.5`}>
              <div
                className={`size-6 rounded-md ${bg} flex items-center justify-center`}
              >
                <div className={`size-3 rounded-sm ${tc} opacity-60`} />
              </div>
              <div className={`${bar} w-3/4`} />
              <div className={`${sbar} w-full`} />
              <div className={`${sbar} w-2/3`} />
            </div>
          ))}
        </div>
      );
    case "work-experience":
      return (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="grid grid-cols-[48px_1fr] gap-2">
              <div className="space-y-1.5">
                <div className="size-8 rounded-surface border border-border/50 bg-card" />
                <div className={`${sbar} w-full`} />
              </div>
              <div className="space-y-1 pt-0.5">
                <div className={`${bar} w-1/2`} />
                <div className={`${sbar} w-full`} />
                <div className={`${sbar} w-3/4`} />
                <div className="mt-1 flex gap-1">
                  {[0, 1].map((j) => (
                    <div key={j} className={tag} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    case "testimonials":
      return (
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map((i) => (
            <div key={i} className={`${block} space-y-2 p-3`}>
              <div className={`${sbar} w-full`} />
              <div className={`${sbar} w-5/6`} />
              <div className={`${sbar} w-3/4`} />
              <div className="flex items-center gap-1.5 border-t border-border/30 pt-1.5">
                <div className="size-4 rounded-full bg-muted-foreground/20" />
                <div className="space-y-0.5">
                  <div className={`${sbar} w-12`} />
                  <div className="h-1 w-8 rounded-full bg-muted-foreground/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    case "impact-numbers":
      return (
        <div className="grid grid-cols-4 gap-px overflow-hidden rounded-surface border border-border/50 bg-border/30">
          {["60%", "12k", "4yr", "30+"].map((v) => (
            <div key={v} className="bg-card p-2.5 text-center">
              <div className="text-sm font-bold text-foreground">{v}</div>
              <div className={`${sbar} mt-1 w-full`} />
            </div>
          ))}
        </div>
      );
    case "open-source":
      return (
        <div className="space-y-1.5">
          {["vercel/next.js", "tailwindlabs/tw", "shadcn/ui"].map((r) => (
            <div key={r} className={`${block} flex items-center gap-2 p-2`}>
              <div className="size-5 rounded bg-muted-foreground/10" />
              <div className="flex-1 space-y-0.5">
                <div className="text-[9px] text-muted-foreground">{r}</div>
                <div className={`${sbar} w-2/3`} />
              </div>
              <div className="text-[9px] text-chart-3">★ 128k</div>
            </div>
          ))}
        </div>
      );
    case "speaking":
      return (
        <div className="space-y-1.5">
          {[
            ["Talk", "bg-chart-5/10 text-chart-5", "JSConf 2024"],
            ["Article", "bg-chart-1/10 text-chart-1", "Smashing Mag"],
            ["Podcast", "bg-chart-4/10 text-chart-4", "Syntax.fm"],
          ].map(([t, c, v]) => (
            <div key={t} className={`${block} flex items-center gap-2 p-2`}>
              <div
                className={`flex size-6 items-center justify-center rounded-control ${c} text-[8px] font-bold`}
              >
                {t[0]}
              </div>
              <div className="flex-1 space-y-0.5">
                <div className={`${sbar} w-3/4`} />
                <div className="text-[8px] text-muted-foreground">{v}</div>
              </div>
            </div>
          ))}
        </div>
      );
    case "press-awards":
      return (
        <div className="flex flex-wrap gap-1.5">
          {[
            "Awwwards SOTD",
            "CSS Awards",
            "Product Hunt #1",
            "Smashing Mag",
          ].map((a) => (
            <div
              key={a}
              className={`${block} px-2.5 py-1.5 text-[9px] font-medium text-muted-foreground`}
            >
              {a}
            </div>
          ))}
        </div>
      );
    case "client-logos":
      return (
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className={`${block} flex aspect-square items-center justify-center`}
            >
              <div className="size-5 rounded bg-muted-foreground/15" />
            </div>
          ))}
        </div>
      );
    case "now-page":
      return (
        <div className="space-y-1.5">
          <div className="mb-2 flex items-center gap-1.5">
            <div className="size-1.5 rounded-full bg-chart-2" />
            <div className="text-[8px] text-muted-foreground">
              Updated March 2026
            </div>
          </div>
          {[
            ["bg-chart-2", "Work"],
            ["bg-chart-1", "Reading"],
            ["bg-chart-3", "Travel"],
          ].map(([c, l]) => (
            <div key={l} className={`${block} flex items-start gap-2 p-2`}>
              <div className={`mt-1 size-2 shrink-0 rounded-full ${c}`} />
              <div className="space-y-0.5">
                <div className="text-[8px] text-muted-foreground">{l}</div>
                <div className={`${sbar} w-full`} />
              </div>
            </div>
          ))}
        </div>
      );
    case "uses":
      return (
        <div className="space-y-2.5">
          {[
            ["Editor", "Neovim", "tmux"],
            ["Hardware", "MacBook", "HHKB"],
          ].map(([cat, ...tools]) => (
            <div key={cat}>
              <div className="mb-1 text-[8px] uppercase tracking-wide text-muted-foreground">
                {cat}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {tools.map((t) => (
                  <div
                    key={t}
                    className={`${block} flex items-center gap-1.5 p-2`}
                  >
                    <div className="size-4 rounded bg-muted-foreground/15" />
                    <div className={`${sbar} flex-1`} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    case "process":
      return (
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={`${block} space-y-1.5 p-2`}>
              <div className="flex size-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                {n}
              </div>
              <div className={`${bar} w-3/4`} />
              <div className={`${sbar} w-full`} />
            </div>
          ))}
        </div>
      );
    case "faq":
      return (
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`${block} flex items-center justify-between p-2.5`}
            >
              <div className={`${bar} w-2/3`} />
              <div className="size-2 rotate-45 border-b border-r border-muted-foreground/40" />
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}
