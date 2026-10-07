"use client";

import { useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Edit,
  MoreHorizontal,
  PlayCircle,
  Plus,
  Archive,
  ArchiveRestore,
  Trash2,
} from "lucide-react";
import type { LearningSubject, LearningTopic } from "@/types";
import { isDue } from "./spaced-review";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ModuleCardProps {
  /** Null for the unfiled group — a topic does not need a module. */
  subject: LearningSubject | null;
  topics: LearningTopic[];
  today: string;
  onTopicClick: (topic: LearningTopic) => void;
  onEditSubject?: () => void;
  onDeleteSubject?: () => void;
  onAddTopic: () => void;
  onEditTopic: (topic: LearningTopic) => void;
  onDeleteTopic: (topicId: string) => void;
  /**
   * Retire a topic without losing its review history. Every list in the module
   * already filters on `archived_at`; until now nothing could set it, so the
   * only way to clear a finished topic was to delete it and lose the record of
   * having learned it.
   */
  onArchiveTopic: (topic: LearningTopic) => void;
}

const statusConfig = {
  "To Learn": { icon: Circle, color: "text-muted-foreground" },
  Learning: { icon: PlayCircle, color: "text-primary" },
  Practicing: { icon: BookOpen, color: "text-info" },
  Mastered: { icon: CheckCircle2, color: "text-success" },
};

export function ModuleCard({
  subject,
  topics,
  today,
  onTopicClick,
  onEditSubject,
  onDeleteSubject,
  onAddTopic,
  onEditTopic,
  onDeleteTopic,
  onArchiveTopic,
}: ModuleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  // "Settled" is a topic on a three-week-plus interval — earned by recall
  // rather than declared by hand, which is what "Mastered" was.
  const completed = topics.filter((t) => (t.interval_days ?? 0) >= 21).length;
  const total = topics.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <Card className="overflow-hidden shadow-none">
      <CardHeader
        className="cursor-pointer p-3 transition-colors hover:bg-muted/50 sm:p-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-control transition-transform duration-base",
                isExpanded ? "bg-primary/10" : "bg-muted",
              )}
            >
              {isExpanded ? (
                <ChevronDown className="size-4 text-primary" />
              ) : (
                <ChevronRight className="size-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-base font-bold">
                {subject?.name ?? "Unfiled"}
              </CardTitle>
              {/* Desktop Progress */}
              <div className="mt-1 hidden items-center gap-2 sm:flex">
                <span className="text-xs text-muted-foreground">
                  {completed}/{total} settled
                </span>
                <Progress value={progress} className="h-1.5 w-20" />
                <span className="text-xs font-medium text-primary">
                  {Math.round(progress)}%
                </span>
              </div>
              {/* Mobile Progress */}
              <div className="mt-0.5 text-xs text-muted-foreground sm:hidden">
                {completed}/{total} done
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Module actions"
                className="size-8 shrink-0"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEditSubject && (
                <DropdownMenuItem onClick={onEditSubject}>
                  <Edit className="mr-2 size-4" /> Edit module
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onAddTopic}>
                <Plus className="mr-2 size-4" /> Add topic
              </DropdownMenuItem>
              {onDeleteSubject && (
                <DropdownMenuItem
                  onClick={onDeleteSubject}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 size-4" /> Delete module
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="border-t px-2 pb-2 pt-0 sm:px-4 sm:pb-4">
          {topics.length === 0 ? (
            <div className="py-6 text-center">
              <p className="mb-3 text-sm text-muted-foreground">
                No topics yet
              </p>
              <Button variant="outline" size="sm" onClick={onAddTopic}>
                <Plus className="mr-2 size-4" /> Add First Topic
              </Button>
            </div>
          ) : (
            <div className="mt-2 space-y-1">
              {topics.map((topic) => {
                // `status` is a nullable column; "To Learn" is its DB default.
                const config =
                  statusConfig[topic.status ?? "To Learn"] ??
                  statusConfig["To Learn"];
                const StatusIcon = config.icon;
                const isActive = isDue(topic, today);
                return (
                  <div
                    key={topic.id}
                    className={cn(
                      "group flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors",
                      isActive ? "bg-primary/10" : "hover:bg-muted/50",
                    )}
                    onClick={() => onTopicClick(topic)}
                  >
                    <StatusIcon
                      className={cn("size-4 shrink-0", config.color)}
                    />
                    <span className="flex-1 truncate text-sm">
                      {topic.title}
                    </span>
                    {isActive && (
                      <Badge
                        variant="secondary"
                        className="bg-primary/15 text-micro text-primary"
                      >
                        Active
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Topic actions"
                          className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditTopic(topic)}>
                          <Edit className="mr-2 size-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onArchiveTopic(topic)}>
                          {topic.archived_at ? (
                            <>
                              <ArchiveRestore className="mr-2 size-4" /> Restore
                            </>
                          ) : (
                            <>
                              <Archive className="mr-2 size-4" /> Archive
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDeleteTopic(topic.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 size-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full justify-start text-muted-foreground hover:text-foreground"
                onClick={onAddTopic}
              >
                <Plus className="mr-2 size-4" /> Add Topic
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
