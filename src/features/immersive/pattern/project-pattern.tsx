import { projectPattern } from "./pattern";

/** The pattern as decoration: no role, no text, drawn in the current colour. */
export function ProjectPattern({
  title,
  tags,
  className,
}: {
  title: string;
  tags?: readonly string[] | null;
  className?: string;
}) {
  const { kind, paths } = projectPattern(title, tags ?? []);
  return (
    <svg
      aria-hidden
      data-pattern={kind}
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      className={className}
    >
      {paths.map((d, index) => (
        <path key={`${index}-${d}`} d={d} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
