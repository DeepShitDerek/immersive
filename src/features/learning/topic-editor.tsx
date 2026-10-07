"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  FileText,
  Globe,
  GraduationCap,
  Hourglass,
  Layers,
  Link as LinkIcon,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import type {
  LearningStatus,
  LearningTopic,
  LearningMaterialKind,
} from "@/types";
import { useSaveTopicMutation } from "@/store/api/adminApi";
import NovelEditor from "@/components/admin/novel-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn, formatDate, getErrorMessage } from "@/lib/utils";
import { SaveStatus } from "@/components/admin/shared";
import { urlOrEmpty } from "@/lib/schemas";
import { MaterialFields } from "./material-fields";
import { SessionTracker } from "./session-tracker";

/* ── Status pipeline ── */
const STATUS_STEPS: { value: LearningStatus; label: string }[] = [
  { value: "To Learn", label: "Queue" },
  { value: "Learning", label: "Learning" },
  { value: "Practicing", label: "Practicing" },
  { value: "Mastered", label: "Mastered" },
];

const StatusPipeline = ({
  current,
  onChange,
}: {
  current: LearningStatus;
  onChange: (s: LearningStatus) => void;
}) => (
  <div className="flex items-center rounded-surface border border-border/50 bg-secondary/40 p-1">
    {STATUS_STEPS.map((step) => (
      <button
        key={step.value}
        type="button"
        aria-pressed={current === step.value}
        onClick={() => onChange(step.value)}
        className={cn(
          "relative rounded-md px-3 py-1 text-micro font-semibold transition-colors duration-base focus-ring",
          current === step.value
            ? "bg-background text-foreground shadow-e1 ring-1 ring-border/50"
            : "text-muted-foreground hover:bg-background/40 hover:text-foreground/80",
        )}
      >
        {step.label}
      </button>
    ))}
  </div>
);

/* ── Resources ── */
const parseResource = (rawText: string | undefined | null) => {
  if (!rawText) return { type: "Link", title: "Untitled Resource" };
  const types = [
    "Article",
    "Video",
    "Course",
    "Official",
    "Roadmap",
    "OpenSource",
  ];
  for (const type of types) {
    if (rawText.startsWith(type))
      return { type, title: rawText.substring(type.length).trim() };
  }
  return { type: "Link", title: rawText };
};

const getResourceIcon = (type: string) => {
  switch (type) {
    case "Video":
      return <Video className="size-3.5 text-muted-foreground" aria-hidden />;
    case "Article":
      return (
        <FileText className="size-3.5 text-muted-foreground" aria-hidden />
      );
    case "Course":
      return (
        <GraduationCap className="size-3.5 text-muted-foreground" aria-hidden />
      );
    case "Official":
      return <Globe className="size-3.5 text-muted-foreground" aria-hidden />;
    case "OpenSource":
      return <Globe className="size-3.5 text-muted-foreground" aria-hidden />;
    default:
      return (
        <LinkIcon className="size-3.5 text-muted-foreground" aria-hidden />
      );
  }
};

const ResourceCard = ({
  resource,
  onDelete,
}: {
  resource: { name: string; url: string };
  onDelete: () => void;
}) => {
  const { type, title } = parseResource(resource.name);
  return (
    <div className="group relative flex items-start gap-3 rounded-surface border bg-card p-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control bg-secondary">
        {getResourceIcon(type)}
      </div>
      <div className="min-w-0 flex-1 pr-6">
        <div className="mb-0.5 flex items-center gap-2">
          <Badge
            variant="secondary"
            className="h-5 rounded-[4px] px-1.5 text-micro font-normal text-muted-foreground"
          >
            {type}
          </Badge>
        </div>
        <a
          href={resource.url}
          target="_blank"
          rel="noreferrer"
          className="block text-xs font-medium leading-snug hover:text-primary hover:underline sm:text-sm"
        >
          {title || resource.name}
        </a>
      </div>
      {/* Shown on hover and on focus: it was invisible to the keyboard. */}
      <button
        type="button"
        aria-label={`Remove ${title || resource.name}`}
        onClick={(e) => {
          e.preventDefault();
          onDelete();
        }}
        className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-ring group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </div>
  );
};

const ResourceList = ({
  resources,
  onAdd,
  onDelete,
}: {
  resources: { name: string; url: string }[];
  onAdd: () => void;
  onDelete: (index: number) => void;
}) => (
  <>
    <div className="mb-4 flex items-center justify-between">
      <div className="t-micro flex items-center gap-2">
        <Layers className="size-3.5" /> Resources{" "}
        <Badge
          variant="secondary"
          className="h-5 min-w-[20px] justify-center px-1.5 text-micro"
        >
          {resources.length}
        </Badge>
      </div>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Add a resource"
        className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
        onClick={onAdd}
      >
        <Plus className="size-4" aria-hidden />
      </Button>
    </div>
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {resources.map((res, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, height: 0 }}
          >
            <ResourceCard resource={res} onDelete={() => onDelete(i)} />
          </motion.div>
        ))}
      </AnimatePresence>
      {resources.length === 0 && (
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full flex-col items-center justify-center rounded-surface border border-dashed border-border p-6 text-center transition-colors hover:bg-muted/30 focus-ring"
        >
          <span className="text-xs font-medium text-foreground">
            No resources yet
          </span>
          <span className="mt-1 text-micro text-muted-foreground">
            Add links, videos, or docs.
          </span>
        </button>
      )}
    </div>
  </>
);

/* ── Main component ── */

interface TopicEditorProps {
  topic: LearningTopic | null;
  onBack: () => void;
  onTopicUpdate: (updatedTopic: LearningTopic) => void;
}

export function TopicEditor({
  topic,
  onBack,
  onTopicUpdate,
}: TopicEditorProps) {
  const isMobile = useIsMobile();
  const [coreNotes, setCoreNotes] = useState("");
  const [status, setStatus] = useState<LearningStatus>("To Learn");
  const [material, setMaterial] = useState<{
    kind: LearningMaterialKind;
    prompt: string;
    answer: string;
    choices: string[];
  }>({ kind: "recall", prompt: "", answer: "", choices: [] });
  const [resources, setResources] = useState<{ name: string; url: string }[]>(
    [],
  );
  const [isAddResourceOpen, setIsAddResourceOpen] = useState(false);
  const [newResName, setNewResName] = useState("");
  const [newResUrl, setNewResUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  const [saveTopic, { isLoading: isSaving }] = useSaveTopicMutation();

  useEffect(() => {
    if (topic) {
      setCoreNotes(topic.core_notes || "");
      setStatus(topic.status || "To Learn");
      setMaterial({
        // The column has a default, so an existing row reads as `recall` and
        // behaves exactly as it did before this field existed.
        kind: topic.kind ?? "recall",
        prompt: topic.prompt ?? "",
        answer: topic.answer ?? "",
        choices: topic.choices ?? [],
      });
      const rawResources = topic.resources || [];
      setResources(
        rawResources.map((res) => ({
          name: res.name || "Untitled",
          url: res.url || "",
        })),
      );
    }
  }, [topic]);

  const handleSave = useCallback(
    async (updateData: Partial<LearningTopic>, isAutosave = false) => {
      if (!topic) return;
      try {
        const updatedTopic = await saveTopic({
          id: topic.id,
          ...updateData,
        }).unwrap();
        if (!isAutosave) toast.success("Topic saved");
        onTopicUpdate(updatedTopic);
      } catch (err) {
        toast.error("Failed to save", { description: getErrorMessage(err) });
      }
    },
    [topic, saveTopic, onTopicUpdate],
  );

  // Debounced autosave for the notes editor
  useEffect(() => {
    if (!topic || coreNotes === (topic.core_notes || "")) return;
    const handler = setTimeout(
      () => handleSave({ core_notes: coreNotes }, true),
      2000,
    );
    return () => clearTimeout(handler);
  }, [coreNotes, topic, handleSave]);

  const handleStatusChange = (newStatus: LearningStatus) => {
    setStatus(newStatus);
    handleSave({ status: newStatus });
  };

  const validateUrl = (url: string): boolean => {
    const result = urlOrEmpty.safeParse(url);
    if (!result.success) {
      setUrlError("Please enter a valid URL");
      return false;
    }
    setUrlError(null);
    return true;
  };

  const handleAddResource = () => {
    if (!newResName || !newResUrl || !validateUrl(newResUrl)) return;
    const updatedResources = [
      ...resources,
      { name: newResName, url: newResUrl },
    ];
    setResources(updatedResources);
    handleSave({ resources: updatedResources, core_notes: coreNotes });
    setNewResName("");
    setNewResUrl("");
    setIsAddResourceOpen(false);
  };

  const handleDeleteResource = (index: number) => {
    const updatedResources = resources.filter((_, i) => i !== index);
    setResources(updatedResources);
    handleSave({ resources: updatedResources, core_notes: coreNotes });
  };

  if (!topic) return null;

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden bg-background",
        !isMobile && "rounded-surface border",
      )}
    >
      {/* Fixed header */}
      <header
        className={cn(
          "z-sticky flex shrink-0 flex-col justify-between gap-4 border-b bg-background/80 px-4 py-3 backdrop-blur-md md:flex-row md:items-center",
          !isMobile && "rounded-t-xl",
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to topics"
            onClick={onBack}
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-heading text-lg font-bold tracking-tight">
                {topic.title}
              </h1>
            </div>
            <SaveStatus
              className="mt-0.5"
              state={isSaving ? "saving" : "idle"}
              text={
                isSaving
                  ? undefined
                  : `Edited ${formatDate(new Date(topic.updated_at || new Date()))}`
              }
            />
          </div>
        </div>
        <StatusPipeline current={status} onChange={handleStatusChange} />
      </header>

      {/* Scrollable content: desktop side-by-side, mobile stacked */}
      <div className="flex-1 overflow-hidden">
        <div className={cn("h-full", !isMobile && "flex gap-0")}>
          {/* Left column: editor */}
          <div
            className={cn(
              "overflow-y-auto",
              isMobile ? "h-auto" : "min-w-0 flex-1",
            )}
          >
            {/* Mobile-only: timer above editor */}
            {isMobile && (
              <div className="px-4 pb-2 pt-6">
                <div className="mb-6 rounded-surface border bg-card p-4">
                  <div className="t-micro mb-3 flex items-center gap-2">
                    <Hourglass className="size-3.5" /> Study Session
                  </div>
                  <SessionTracker topic={topic} />
                </div>
              </div>
            )}

            <div className="px-4 pt-4">
              <MaterialFields
                kind={material.kind}
                prompt={material.prompt}
                answer={material.answer}
                choices={material.choices}
                onChange={(patch) => {
                  const next = { ...material, ...patch };
                  setMaterial(next);
                  handleSave({
                    kind: next.kind,
                    prompt: next.prompt || null,
                    answer: next.answer || null,
                    // Blank rows are what an unfinished edit leaves behind;
                    // storing them would render an empty option in the quiz.
                    choices: next.choices.filter((choice) => choice.trim())
                      .length
                      ? next.choices.filter((choice) => choice.trim())
                      : null,
                  });
                }}
              />
            </div>

            {/* Left padding on wide screens is the block handle's margin. */}
            <div className="flex-1 px-4 pb-12 pt-4 md:pl-14">
              <NovelEditor
                value={coreNotes}
                onChange={setCoreNotes}
                placeholder="Start taking notes, or press '/' for commands…"
                minHeight="20rem"
              />
            </div>

            {/* Mobile-only: resources below editor */}
            {isMobile && (
              <div className="border-t bg-muted/5 px-6 pb-20 pt-4">
                <ResourceList
                  resources={resources}
                  onAdd={() => setIsAddResourceOpen(true)}
                  onDelete={handleDeleteResource}
                />
              </div>
            )}
          </div>

          {/* Right column: timer + resources sidebar (desktop only) */}
          {!isMobile && (
            <div className="w-80 shrink-0 overflow-y-auto border-l bg-muted/5 xl:w-96">
              <div className="p-4">
                <div className="rounded-surface border bg-card p-4">
                  <div className="t-micro mb-3 flex items-center gap-2">
                    <Hourglass className="size-3.5" /> Study Session
                  </div>
                  <SessionTracker topic={topic} />
                </div>
              </div>

              <Separator className="mx-4 w-auto" />

              <div className="p-4 pb-20">
                <ResourceList
                  resources={resources}
                  onAdd={() => setIsAddResourceOpen(true)}
                  onDelete={handleDeleteResource}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={isAddResourceOpen}
        onOpenChange={(open) => {
          setIsAddResourceOpen(open);
          if (!open) {
            setUrlError(null);
            setNewResName("");
            setNewResUrl("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Resource</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="e.g. React Docs"
                value={newResName}
                onChange={(e) => setNewResName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                placeholder="https://..."
                value={newResUrl}
                onChange={(e) => {
                  setNewResUrl(e.target.value);
                  if (urlError) setUrlError(null);
                }}
                className={urlError ? "border-destructive" : ""}
              />
              {urlError && (
                <p className="text-xs text-destructive">{urlError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddResourceOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddResource}
              disabled={!newResName || !newResUrl}
            >
              Add Resource
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
