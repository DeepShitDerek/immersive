import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** The tertiary action that ends a section: text with an arrow ("All work"). */
export function SectionLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 rounded-control text-sm font-semibold text-primary underline-offset-4 hover:underline focus-ring"
    >
      {children}
      <ArrowRight
        aria-hidden
        className="size-4 transition-transform duration-fast group-hover:translate-x-0.5 motion-reduce:transition-none"
      />
    </Link>
  );
}
