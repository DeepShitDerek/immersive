"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, FileCheck2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { getErrorMessage } from "@/lib/utils";
import {
  type Application,
  documentProgress,
  type DocumentStatus,
  isOpen,
} from "../domain/applications";
import {
  useDeleteApplicationDocMutation,
  useSaveApplicationDocMutation,
} from "../data/money-api";
import { Amount } from "./amount";
import {
  ApplicationSheet,
  PRODUCT_LABEL,
  STATUS_LABEL,
} from "./application-sheet";
import { LenderReportView } from "./lender-report-view";
import { useMoney } from "./money-context";

const DOC_STATUS: Record<DocumentStatus, string> = {
  needed: "Needed",
  ready: "Ready",
  sent: "Sent",
};

/**
 * Credit applications: each one's status and document checklist,
 * and the lender report built for it. With none chosen, the report is the
 * general summary.
 */
export function ApplicationsPanel() {
  const { applications } = useMoney();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Application | "new" | null>(null);
  const [generalReport, setGeneralReport] = useState(false);
  const selected = applications.find((a) => a.id === selectedId) ?? null;

  const sheet = (
    <ApplicationSheet
      application={editing === "new" ? null : editing}
      open={editing !== null}
      onOpenChange={(o) => !o && setEditing(null)}
      onSaved={(id) => editing === "new" && setSelectedId(id)}
    />
  );

  if (selected || generalReport) {
    return (
      <div className="space-y-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (setSelectedId(null), setGeneralReport(false))}
        >
          <ArrowLeft className="mr-2 size-4" /> All applications
        </Button>
        {selected && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-lg font-semibold">
                  {selected.lender} — {PRODUCT_LABEL[selected.product]}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {STATUS_LABEL[selected.status]}
                  {selected.amountMinor ? (
                    <>
                      {" "}
                      ·{" "}
                      <Amount
                        minor={selected.amountMinor}
                        currency={selected.currency}
                      />
                    </>
                  ) : null}
                  {selected.rate != null ? ` · ${selected.rate}%` : ""}
                  {selected.submittedOn
                    ? ` · submitted ${selected.submittedOn}`
                    : ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(selected)}
              >
                Edit
              </Button>
            </div>
            <DocumentChecklist application={selected} />
          </>
        )}
        <LenderReportView application={selected} />
        {sheet}
      </div>
    );
  }

  const open = applications.filter((a) => isOpen(a.status));
  const closed = applications.filter((a) => !isOpen(a.status));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Track each application for credit — the documents it needs, where it
          stands — and print a summary for the lender.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGeneralReport(true)}>
            <FileCheck2 className="mr-2 size-4" /> Lender report
          </Button>
          <Button onClick={() => setEditing("new")}>
            <Plus className="mr-2 size-4" /> Application
          </Button>
        </div>
      </div>
      {applications.length === 0 ? (
        <p className="rounded-surface border border-dashed p-8 text-center text-sm text-muted-foreground">
          No applications yet. Add one when you start talking to a lender.
        </p>
      ) : (
        [
          ["In progress", open],
          ["Closed", closed],
        ].map(([title, list]) =>
          (list as Application[]).length === 0 ? null : (
            <section
              key={title as string}
              aria-label={title as string}
              className="space-y-2"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {title as string}
              </h3>
              <ul className="divide-y rounded-surface border bg-card text-sm">
                {(list as Application[]).map((a) => {
                  const progress = documentProgress(a.documents);
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40"
                        onClick={() => setSelectedId(a.id)}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">
                            {a.lender} — {PRODUCT_LABEL[a.product]}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {STATUS_LABEL[a.status]}
                            {progress.total > 0
                              ? ` · documents ${progress.done}/${progress.total}`
                              : ""}
                          </span>
                        </span>
                        {a.amountMinor ? (
                          <Amount minor={a.amountMinor} currency={a.currency} />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ),
        )
      )}
      {sheet}
    </div>
  );
}

function DocumentChecklist({ application }: { application: Application }) {
  const [saveDoc] = useSaveApplicationDocMutation();
  const [deleteDoc] = useDeleteApplicationDocMutation();
  const [name, setName] = useState("");
  const docs = [...application.documents].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
  const progress = documentProgress(docs);

  const run = async (action: Promise<unknown>) => {
    try {
      await action;
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (docs.some((d) => d.name.toLowerCase() === trimmed.toLowerCase()))
      return toast.error("That document is already on the list.");
    await run(
      saveDoc({
        applicationId: application.id,
        name: trimmed.slice(0, 160),
        status: "needed",
        note: null,
        sortOrder: (docs.at(-1)?.sortOrder ?? 0) + 1,
      })
        .unwrap()
        .then(() => setName("")),
    );
  };

  return (
    <section
      aria-labelledby="docs-heading"
      className="rounded-surface border bg-card p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h4 id="docs-heading" className="font-heading text-base font-semibold">
          Documents
        </h4>
        <span className="text-sm text-muted-foreground">
          {progress.done} of {progress.total} ready
        </span>
      </div>
      <ul className="mt-3 divide-y text-sm">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center gap-3 py-2">
            <span
              className={cn(
                "flex-1",
                d.status !== "needed" &&
                  "text-muted-foreground line-through decoration-muted-foreground/50",
              )}
            >
              {d.name}
            </span>
            <Select
              value={d.status}
              onValueChange={(v) =>
                run(
                  saveDoc({
                    applicationId: application.id,
                    id: d.id,
                    name: d.name,
                    status: v as DocumentStatus,
                    note: d.note,
                    sortOrder: d.sortOrder,
                  }).unwrap(),
                )
              }
            >
              <SelectTrigger
                className="h-8 w-28"
                aria-label={`Status of ${d.name}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DOC_STATUS) as DocumentStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {DOC_STATUS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${d.name}`}
              onClick={() => run(deleteDoc(d.id).unwrap())}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <Input
          aria-label="Another document"
          placeholder="Another document…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={160}
        />
        <Button type="submit" variant="outline">
          Add
        </Button>
      </form>
    </section>
  );
}
