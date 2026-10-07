import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Band } from "@/components/layout/band";
import { PRODUCT } from "@/lib/product";

/**
 * Three ways in, one line each, for the three people who arrive here
 * (information-architecture.md §3, A-2): someone hiring goes to the work,
 * someone with a project goes to the form with that topic already chosen,
 * and a developer who likes the site goes to the template. Text, not tiles:
 * no icons, no cards. The template line exists only where the template page
 * does.
 */
export function RouteLinks() {
  const routes = [
    {
      question: "Hiring for an AI role?",
      label: "See the work",
      href: "/work/",
    },
    {
      question: "Have a project in mind?",
      label: "Tell me about it",
      href: "/contact/?topic=project",
    },
    ...(PRODUCT.show
      ? [
          {
            question: "Want a site like this one?",
            label: `Get ${PRODUCT.name}`,
            href: "/kit/",
          },
        ]
      : []),
  ];

  return (
    <Band weight="content" rhythm="tight" aria-label="Where to start">
      <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-3">
        {routes.map((route) => (
          <li key={route.href} className="text-base">
            <span className="text-muted-foreground">{route.question}</span>{" "}
            <Link
              href={route.href}
              className="group inline-flex items-center gap-1 rounded-control font-semibold text-primary underline-offset-4 hover:underline focus-ring"
            >
              {route.label}
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform duration-fast group-hover:translate-x-0.5 motion-reduce:transition-none"
              />
            </Link>
          </li>
        ))}
      </ul>
    </Band>
  );
}
