import {
  AtSign,
  Github,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  Rss,
  Send,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";

/**
 * Icons for social links, keyed by the link's `id`.
 *
 * The list of links is owner-editable and open — it used to be fixed to
 * whatever shipped in the defaults file — so an id that is not in this map is
 * an ordinary case rather than a mistake, and `socialIcon` answers with a
 * generic globe instead of nothing. A row with no icon at all reads as broken
 * next to rows that have one.
 */
const SOCIAL_ICONS: Record<string, LucideIcon> = {
  github: Github,
  linkedin: Linkedin,
  email: Mail,
  mail: Mail,
  twitter: Twitter,
  x: Twitter,
  mastodon: AtSign,
  bluesky: AtSign,
  instagram: Instagram,
  youtube: Youtube,
  telegram: Send,
  rss: Rss,
  website: Globe,
};

/** The icon for a link id, falling back to a globe for anything unrecognised. */
export function socialIcon(id: string): LucideIcon {
  return SOCIAL_ICONS[id.trim().toLowerCase()] ?? Globe;
}
