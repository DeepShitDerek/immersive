import type { SiteContent } from "@/types";
import { isLinkable, TextLink } from "@/features/sections/shared";

/** Beat 5: one calm panel, the owner's status. No motion. */
export function Now({
  status,
}: {
  status: SiteContent["profile_data"]["status_panel"];
}) {
  const exploring = status.currently_exploring;
  const latest = status.latestProject;
  const items = (exploring?.items ?? []).filter((entry) => entry.trim());

  return (
    <section
      data-beat="now"
      aria-labelledby="im-now-heading"
      className="im-rule px-[var(--band-x)] py-20 max-[399px]:px-4 md:py-32"
    >
      <div className="im-panel max-w-3xl p-6 sm:p-10">
        <h2 id="im-now-heading" className="im-mono">
          {status.title?.trim() || "Now"}
        </h2>
        {status.availability && (
          <p className="im-display im-display-md mt-4 !normal-case">
            {status.availability}
          </p>
        )}
        {items.length > 0 && (
          <div className="mt-8">
            <h3 className="im-mono">{exploring.title}</h3>
            <ul className="mt-3 space-y-1.5 text-base text-foreground">
              {items.map((entry, index) => (
                <li key={`${index}-${entry}`}>{entry}</li>
              ))}
            </ul>
          </div>
        )}
        {latest?.name && isLinkable(latest.href) && (
          <p className="mt-8 text-base">
            <span className="text-muted-foreground">{latest.name} </span>
            <TextLink
              href={latest.href}
              className="rounded-control font-medium text-foreground underline decoration-primary underline-offset-4 focus-ring"
            >
              {latest.linkText || latest.name}
            </TextLink>
          </p>
        )}
      </div>
    </section>
  );
}
