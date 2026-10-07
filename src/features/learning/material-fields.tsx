"use client";

import { Plus, X } from "lucide-react";
import type { LearningMaterialKind } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

/**
 * The three kinds, and the fields each one needs.
 *
 * Without a screen these columns would be a feature that exists only in the
 * schema — the trap this project has already paid for nine times, where a hook
 * or a column ships, everything type-checks, and the owner simply finds
 * something they cannot reach.
 *
 * The fields shown change with the kind rather than all appearing at once,
 * because an answer box on a page of reference notes is a question the material
 * does not have.
 */

const KINDS: {
  id: LearningMaterialKind;
  label: string;
  hint: string;
}[] = [
  {
    id: "reference",
    label: "Reference",
    hint: "Material you read. Never enters the review queue.",
  },
  {
    id: "recall",
    label: "Recall",
    hint: "A prompt, then your notes. You rate how it went.",
  },
  {
    id: "quiz",
    label: "Quiz",
    hint: "A question with a right answer, so you can be marked.",
  },
];

export function MaterialFields({
  kind,
  prompt,
  answer,
  choices,
  onChange,
}: {
  kind: LearningMaterialKind;
  prompt: string;
  answer: string;
  choices: string[];
  onChange: (patch: {
    kind?: LearningMaterialKind;
    prompt?: string;
    answer?: string;
    choices?: string[];
  }) => void;
}) {
  const active = KINDS.find((entry) => entry.id === kind) ?? KINDS[1];

  return (
    <section className="space-y-4 rounded-surface border bg-card p-4">
      <div>
        <Label className="text-xs">What kind of material is this?</Label>
        <div
          role="radiogroup"
          aria-label="Material kind"
          className="mt-1.5 flex flex-wrap gap-1.5"
        >
          {KINDS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={entry.id === kind}
              onClick={() => onChange({ kind: entry.id })}
              className={cn(
                "rounded-control px-3 py-1.5 text-xs font-medium transition-colors",
                entry.id === kind
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{active.hint}</p>
      </div>

      {kind !== "reference" && (
        <div className="space-y-1.5">
          <Label htmlFor="topic-prompt" className="text-xs">
            Prompt
          </Label>
          <Textarea
            id="topic-prompt"
            value={prompt}
            rows={2}
            onChange={(event) => onChange({ prompt: event.target.value })}
            placeholder="What are you asked? Leave empty to use the title."
          />
          {/*
            A title is a label you scan in a list; a prompt is the question you
            are asked. Overloading one field makes the list unreadable or the
            question vague, so they are separate — and the prompt is optional,
            because falling back to the title is exactly the old behaviour.
          */}
          <p className="text-xs text-muted-foreground">
            The title is the label in your list. This is the question.
          </p>
        </div>
      )}

      {kind === "quiz" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="topic-answer" className="text-xs">
              Answer
            </Label>
            <Textarea
              id="topic-answer"
              value={answer}
              rows={2}
              onChange={(event) => onChange({ answer: event.target.value })}
              placeholder="The correct answer."
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Choices (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Add options to be shown multiple-choice. The correct one is
              matched by its text, so reordering these cannot change which is
              right — but it does mean the answer above has to match one of them
              exactly.
            </p>
            <ul className="space-y-1.5">
              {choices.map((choice, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Input
                    value={choice}
                    aria-label={`Choice ${index + 1}`}
                    onChange={(event) => {
                      const next = [...choices];
                      next[index] = event.target.value;
                      onChange({ choices: next });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove choice ${index + 1}`}
                    className="size-9 shrink-0"
                    onClick={() =>
                      onChange({
                        choices: choices.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
            {choices.length < 8 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange({ choices: [...choices, ""] })}
              >
                <Plus className="mr-1.5 size-3.5" aria-hidden />
                Add choice
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
