/**
 * What a contact message is about.
 *
 * Its own module, with no zod, on purpose: publicApi — loaded by every public
 * page — needs the labels for the static-mode webhook, and importing them from
 * lib/schemas.ts pulled that whole file (every admin form's schema) into the
 * public bundle, +18 KB on every page.
 *
 * The values mirror the `contact_submissions_topic_check` constraint in
 * db/schema.sql; a test keeps them equal. The prompts give the subject and
 * message fields a start that fits the choice.
 */
export const CONTACT_TOPICS = [
  {
    value: "role",
    label: "A role",
    subjectPrompt: "e.g. Senior AI Engineer at Acme",
    messagePrompt: "The team, the problem, and where the role fits.",
  },
  {
    value: "project",
    label: "A project",
    subjectPrompt: "e.g. A RAG assistant for our support team",
    messagePrompt:
      "What you're building, what exists today, and your timeline.",
  },
  {
    value: "other",
    label: "Something else",
    subjectPrompt: "e.g. A talk, a collaboration, a question",
    messagePrompt: "What's on your mind?",
  },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]["value"];

export const CONTACT_TOPIC_VALUES = CONTACT_TOPICS.map(
  (option) => option.value,
) as [ContactTopic, ...ContactTopic[]];

export function contactTopicLabel(
  topic: string | null | undefined,
): string | null {
  return CONTACT_TOPICS.find((option) => option.value === topic)?.label ?? null;
}
