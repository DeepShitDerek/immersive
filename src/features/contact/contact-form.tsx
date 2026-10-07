"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Send, TriangleAlert } from "lucide-react";
import {
  CONTACT_LIMITS,
  CONTACT_TOPICS,
  contactFormSchema,
  type ContactFormValues,
} from "@/lib/schemas";
import {
  useGetSiteIdentityQuery,
  useSubmitContactFormMutation,
} from "@/store/api/publicApi";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { safeLinkUrl } from "@/lib/safe-url";
import { describeContactError, type ContactErrorView } from "./contact-errors";

/**
 * Fields sit on the card as quiet wells — the page ground inside the card —
 * and take the theme colour on focus rather than a thicker border.
 */
const FIELD =
  "rounded-control bg-background transition-[box-shadow,border-color] duration-base ease-enter focus-visible:border-primary/60 aria-[invalid=true]:border-destructive/60";

/**
 * The outcome stays until the visitor acts. Both used to clear
 * themselves after five seconds: a visitor who looked away came back to an
 * empty form and no word on whether it had sent, and an error vanished before
 * it could be read.
 */
export function ContactForm() {
  const [submitContactForm, { isLoading }] = useSubmitContactFormMutation();
  const { data: identity } = useGetSiteIdentityQuery();
  /** The address replies will go to, once a message has been sent. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [failure, setFailure] = useState<ContactErrorView | null>(null);
  const sentHeading = useRef<HTMLHeadingElement>(null);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { name: "", email: "", subject: "", message: "" },
  });

  // The form is replaced by the confirmation, so focus would otherwise fall
  // to <body>; move it to the confirmation so it is announced and the next
  // Tab lands on "Send another".
  useEffect(() => {
    if (sentTo) sentHeading.current?.focus();
  }, [sentTo]);

  // A link can choose the topic: the home page's "Have a project?"
  // goes to /contact?topic=project. Read after mount, since the page is
  // prerendered without a query string; an unknown value is ignored.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("topic");
    const match = CONTACT_TOPICS.find((option) => option.value === wanted);
    if (match) form.setValue("topic", match.value);
  }, [form]);

  const email = identity?.social_links.find(
    (social) => social.id.toLowerCase() === "email" && social.is_visible,
  );
  const emailHref = safeLinkUrl(email?.url);

  const onSubmit = async (values: ContactFormValues) => {
    setFailure(null);
    try {
      await submitContactForm(values).unwrap();
      setSentTo(values.email);
      form.reset();
    } catch (error) {
      setFailure(describeContactError(error));
    }
  };

  if (sentTo) {
    return (
      <div className="rounded-control bg-primary/10 p-6">
        <h3
          ref={sentHeading}
          tabIndex={-1}
          className="flex items-center gap-2 font-heading text-lg font-semibold focus:outline-none"
        >
          <Check className="size-5 shrink-0 text-primary" aria-hidden />
          Message sent
        </h3>
        <p className="mt-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          Thanks for getting in touch. Replies go to{" "}
          <span className="font-medium text-foreground">{sentTo}</span>.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-5"
          onClick={() => setSentTo(null)}
        >
          Send another message
        </Button>
      </div>
    );
  }

  const errors = form.formState.errors;
  // The choice shapes the prompts below it, so a visitor asking about a role
  // is not asked "What are we building?".
  const topic = CONTACT_TOPICS.find(
    (option) => option.value === form.watch("topic"),
  );

  const field = (
    name: Exclude<keyof ContactFormValues, "topic">,
    label: string,
    props?: {
      textarea?: boolean;
      type?: string;
      placeholder?: string;
      /** Shows a live count once the field is most of the way to its ceiling. */
      max?: number;
    },
  ) => {
    const length = (form.watch(name) ?? "").length;
    // Only worth showing when it is about to matter. A counter on every field
    // from the first keystroke is noise on a form four fields long.
    const showCount = props?.max !== undefined && length > props.max * 0.8;

    return (
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={`contact-${name}`}>{label}</Label>
          {showCount && (
            <span
              aria-live="polite"
              className={cn(
                "text-xs tabular-nums",
                length > props.max!
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {length.toLocaleString()} / {props.max!.toLocaleString()}
            </span>
          )}
        </div>
        {props?.textarea ? (
          <Textarea
            id={`contact-${name}`}
            rows={6}
            placeholder={props.placeholder}
            aria-invalid={!!errors[name]}
            aria-describedby={
              errors[name] ? `contact-${name}-error` : undefined
            }
            className={cn(FIELD, "resize-y py-3")}
            {...form.register(name)}
          />
        ) : (
          <Input
            id={`contact-${name}`}
            type={props?.type ?? "text"}
            placeholder={props?.placeholder}
            aria-invalid={!!errors[name]}
            aria-describedby={
              errors[name] ? `contact-${name}-error` : undefined
            }
            className={cn(FIELD, "h-11")}
            {...form.register(name)}
          />
        )}
        {errors[name] && (
          <p
            id={`contact-${name}-error`}
            role="alert"
            className="text-xs text-destructive"
          >
            {errors[name]?.message}
          </p>
        )}
      </div>
    );
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="space-y-5"
    >
      {/*
        One path serves every kind of enquiry. Native radios in a
        fieldset: the group is one Tab stop, arrow keys move the choice, and a
        screen reader announces the legend with each option.
      */}
      <fieldset
        aria-invalid={!!errors.topic}
        aria-describedby={errors.topic ? "contact-topic-error" : undefined}
        className="space-y-2"
      >
        <legend className="mb-2 text-sm font-medium leading-none">
          What&apos;s this about?
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {CONTACT_TOPICS.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-center rounded-control border bg-background px-4 text-sm font-medium",
                "transition-[border-color,background-color,color] duration-base ease-enter",
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-[length:var(--focus-width)] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                "has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-foreground",
                errors.topic
                  ? "border-destructive/60 text-muted-foreground"
                  : "border-input text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <input
                type="radio"
                value={option.value}
                className="sr-only"
                {...form.register("topic")}
              />
              {option.label}
            </label>
          ))}
        </div>
        {errors.topic && (
          <p
            id="contact-topic-error"
            role="alert"
            className="text-xs text-destructive"
          >
            {errors.topic.message}
          </p>
        )}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        {field("name", "Name", {
          placeholder: "Ada Lovelace",
          max: CONTACT_LIMITS.NAME,
        })}
        {field("email", "Email", {
          type: "email",
          placeholder: "you@example.com",
          max: CONTACT_LIMITS.EMAIL,
        })}
      </div>
      {field("subject", "Subject", {
        placeholder: topic?.subjectPrompt ?? "Project, role, or question",
        max: CONTACT_LIMITS.SUBJECT,
      })}
      {field("message", "Message", {
        textarea: true,
        placeholder: topic?.messagePrompt ?? "What are we working on?",
        max: CONTACT_LIMITS.MESSAGE,
      })}

      <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center">
        <Button
          type="submit"
          size="lg"
          disabled={isLoading}
          className="w-full gap-2 rounded-full px-7 sm:w-auto sm:min-w-44"
        >
          {isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Sending…
            </>
          ) : (
            <>
              <Send className="size-4" aria-hidden />
              Send message
            </>
          )}
        </Button>
      </div>
      {/* Always present, so a screen reader hears the failure when it lands. */}
      <div role="alert" className="text-sm empty:hidden">
        {failure && (
          <div
            data-contact-error={failure.kind}
            className="flex gap-2 rounded-control bg-destructive/10 px-3 py-2.5 font-medium text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="min-w-0">
              {failure.message}
              {emailHref && (
                <>
                  {" "}
                  You can also{" "}
                  <a
                    href={emailHref}
                    className="underline underline-offset-2 hover:no-underline"
                  >
                    email me directly
                  </a>
                  .
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </form>
  );
}
