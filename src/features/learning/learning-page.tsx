"use client";

import { useMemo, useState } from "react";
import { BookOpen, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { LearningSubject, LearningTopic } from "@/types";
import {
  useDeleteSubjectMutation,
  useArchiveTopicMutation,
  useDeleteTopicMutation,
  useGetLearningDataQuery,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  FormSheet,
  LoadingState,
  ManagerWrapper,
  ModuleTabs,
  PageHeader,
  LoadError,
} from "@/components/admin/shared";
import { useUndoableDelete } from "@/hooks/use-undoable-delete";
import { useUrlTab } from "@/hooks/use-url-tab";
import { getErrorMessage } from "@/lib/utils";
import { ModuleCard } from "./module-card";
import { TopicEditor } from "./topic-editor";
import { SubjectForm } from "./subject-form";
import { TopicForm } from "./topic-form";
import { ReviewSession } from "./review-session";
import { StudyToday } from "./study-today";
import { WeakAreas } from "./weak-areas";
import { buildQueue, todayIso } from "./spaced-review";

type SheetState =
  | { type: "create-subject" }
  | { type: "edit-subject"; data: LearningSubject }
  | { type: "create-topic"; subjectId?: string }
  | { type: "edit-topic"; data: LearningTopic }
  | null;

const TABS = ["today", "topics"] as const;
type Tab = (typeof TABS)[number];

export default function LearningPage() {
  const [sheetState, setSheetState] = useState<SheetState>(null);
  const [selectedTopic, setSelectedTopic] = useState<LearningTopic | null>(
    null,
  );
  const [isReviewing, setIsReviewing] = useState(false);
  // Today · Topics as views with a URL. The
  // catalogue was a "Modules" toggle that expanded a section headed
  // "Library" at the bottom of the page, the name of another module.
  const [tab, setTab] = useUrlTab<Tab>("today", TABS);

  const {
    data,
    isLoading,
    error: loadError,
    refetch,
  } = useGetLearningDataQuery();
  const [deleteSubject] = useDeleteSubjectMutation();
  const [deleteTopic] = useDeleteTopicMutation();
  const [archiveTopic] = useArchiveTopicMutation();

  /**
   * Retire a topic without losing what it recorded.
   *
   * Deleting a settled topic throws away its interval and review history,
   * which is the evidence that it was ever learned. Archiving keeps the row and
   * takes it out of the lists — which every list here already expected, since
   * they all filter on `archived_at`.
   */
  const handleArchiveTopic = async (topic: LearningTopic) => {
    const restoring = Boolean(topic.archived_at);
    try {
      await archiveTopic({ id: topic.id, archived: !restoring }).unwrap();
      toast.success(restoring ? "Topic restored" : "Topic archived", {
        description: restoring
          ? undefined
          : "Its review history is kept — restore it any time.",
      });
    } catch (error) {
      toast.error(restoring ? "Could not restore it" : "Could not archive it", {
        description: getErrorMessage(error),
      });
    }
  };

  const subjects = useMemo(() => data?.subjects ?? [], [data]);
  const topics = useMemo(() => data?.topics ?? [], [data]);
  const sessions = useMemo(() => data?.sessions ?? [], [data]);
  const reviews = useMemo(() => data?.reviews ?? [], [data]);

  const today = todayIso();

  // Deletes offer Undo instead of asking first. Nothing is deleted
  // until the toast closes, so a module's topics and their review history
  // are all still there if you undo. Archiving remains the way to keep them.
  const { pending: deletingTopics, remove: removeTopicLater } =
    useUndoableDelete<LearningTopic>(async (topic) => {
      try {
        await deleteTopic(topic.id).unwrap();
      } catch (err) {
        toast.error("Couldn't delete the topic", {
          description: getErrorMessage(err),
        });
      }
    });
  const { pending: deletingSubjects, remove: removeSubjectLater } =
    useUndoableDelete<LearningSubject>(async (subject) => {
      try {
        await deleteSubject(subject.id).unwrap();
      } catch (err) {
        toast.error("Couldn't delete the module", {
          description: getErrorMessage(err),
        });
      }
    });

  const shownSubjects = useMemo(
    () =>
      deletingSubjects.size
        ? subjects.filter((s) => !deletingSubjects.has(s.id))
        : subjects,
    [subjects, deletingSubjects],
  );
  const shownTopics = useMemo(
    () =>
      deletingTopics.size || deletingSubjects.size
        ? topics.filter(
            (t) =>
              !deletingTopics.has(t.id) &&
              !(t.subject_id && deletingSubjects.has(t.subject_id)),
          )
        : topics,
    [topics, deletingTopics, deletingSubjects],
  );

  const queue = useMemo(
    () => buildQueue(shownTopics, { today }),
    [shownTopics, today],
  );

  // Due first, then new: finishing what you started beats starting more.
  const sessionQueue = useMemo(() => [...queue.due, ...queue.fresh], [queue]);

  const deleteTopicWithUndo = (id: string) => {
    const topic = topics.find((t) => t.id === id);
    if (!topic) return;
    removeTopicLater(
      topic,
      `Deleted "${topic.title}"`,
      "Its notes and review history go with it when this closes.",
    );
  };

  const deleteSubjectWithUndo = (subject: LearningSubject) => {
    const affected = topics.filter((t) => t.subject_id === subject.id).length;
    removeSubjectLater(
      subject,
      `Deleted "${subject.name}"`,
      affected > 0
        ? `With its ${affected} topic${affected === 1 ? "" : "s"} and their history, when this closes.`
        : undefined,
    );
  };

  const header = (
    <PageHeader
      title="Learning"
      description="What's worth going over today."
      actions={
        <Button onClick={() => setSheetState({ type: "create-topic" })}>
          <Plus className="mr-2 size-4" aria-hidden /> Add topic
        </Button>
      }
    />
  );

  if (loadError && !data) {
    return (
      <ManagerWrapper>
        {header}
        <LoadError what="your learning" error={loadError} onRetry={refetch} />
      </ManagerWrapper>
    );
  }

  if (isLoading) {
    return (
      <ManagerWrapper>
        {header}
        <LoadingState label="Loading your learning" />
      </ManagerWrapper>
    );
  }

  // The notes editor takes the whole screen: writing is the one thing here
  // that benefits from room.
  if (selectedTopic) {
    return (
      <ManagerWrapper className="p-0 md:p-6">
        <TopicEditor
          topic={selectedTopic}
          onBack={() => setSelectedTopic(null)}
          onTopicUpdate={(updated) => {
            if (selectedTopic?.id === updated.id) setSelectedTopic(updated);
          }}
        />
      </ManagerWrapper>
    );
  }

  if (isReviewing) {
    return (
      <ManagerWrapper>
        <ReviewSession
          queue={sessionQueue}
          onExit={() => setIsReviewing(false)}
          onEditTopic={(topic) => {
            setIsReviewing(false);
            setSelectedTopic(topic);
          }}
        />
      </ManagerWrapper>
    );
  }

  return (
    <ManagerWrapper>
      {header}

      <ModuleTabs
        label="Learning"
        tabs={[
          { id: "today", label: "Today" },
          {
            id: "topics",
            label: `Topics ${shownTopics.filter((t) => !t.archived_at).length}`,
          },
        ]}
        current={tab}
        onSelect={setTab}
      />

      {tab === "today" ? (
        shownTopics.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            variant="card"
            title="Start with one topic"
            description="Not a syllabus — one thing you want to remember. Add notes when you have them; the schedule brings it back before you forget it."
            action={{
              label: "Add a topic",
              onClick: () => setSheetState({ type: "create-topic" }),
              icon: Plus,
            }}
          />
        ) : (
          <>
            <StudyToday
              queue={queue}
              topics={shownTopics}
              subjects={shownSubjects}
              sessions={sessions}
              reviews={reviews}
              today={today}
              onStart={() => setIsReviewing(true)}
              onAddTopic={() => setSheetState({ type: "create-topic" })}
            />
            <WeakAreas
              topics={shownTopics}
              onOpen={(topic) =>
                setSheetState({ type: "edit-topic", data: topic })
              }
            />
          </>
        )
      ) : (
        <section aria-label="Topics" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Modules group related topics. They are optional — a topic works
              fine on its own.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSheetState({ type: "create-subject" })}
            >
              <Plus className="mr-2 size-4" aria-hidden /> New module
            </Button>
          </div>

          {shownSubjects.length === 0 && shownTopics.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              variant="bordered"
              title="Nothing filed yet"
              description="Add a topic, and a module if you want to group a few."
            />
          ) : (
            <div className="space-y-3">
              {shownSubjects.map((subject) => (
                <ModuleCard
                  key={subject.id}
                  subject={subject}
                  topics={shownTopics.filter(
                    (t) => t.subject_id === subject.id,
                  )}
                  today={today}
                  onTopicClick={setSelectedTopic}
                  onEditSubject={() =>
                    setSheetState({ type: "edit-subject", data: subject })
                  }
                  onDeleteSubject={() => deleteSubjectWithUndo(subject)}
                  onAddTopic={() =>
                    setSheetState({
                      type: "create-topic",
                      subjectId: subject.id,
                    })
                  }
                  onEditTopic={(topic) =>
                    setSheetState({ type: "edit-topic", data: topic })
                  }
                  onDeleteTopic={deleteTopicWithUndo}
                  onArchiveTopic={(topic) => void handleArchiveTopic(topic)}
                />
              ))}

              {/* A topic does not need a module. Hiding the unfiled ones is
                  what made the catalogue feel like it demanded a curriculum. */}
              {shownTopics.some((t) => !t.subject_id) && (
                <ModuleCard
                  subject={null}
                  topics={shownTopics.filter((t) => !t.subject_id)}
                  today={today}
                  onTopicClick={setSelectedTopic}
                  onAddTopic={() => setSheetState({ type: "create-topic" })}
                  onEditTopic={(topic) =>
                    setSheetState({ type: "edit-topic", data: topic })
                  }
                  onDeleteTopic={deleteTopicWithUndo}
                  onArchiveTopic={(topic) => void handleArchiveTopic(topic)}
                />
              )}
            </div>
          )}
        </section>
      )}

      <FormSheet
        open={!!sheetState}
        onOpenChange={(open) => !open && setSheetState(null)}
        title={
          sheetState?.type === "create-topic"
            ? "New topic"
            : sheetState?.type === "edit-topic"
              ? "Edit topic"
              : sheetState?.type === "create-subject"
                ? "New module"
                : "Edit module"
        }
        description={
          sheetState?.type?.includes("topic")
            ? "A thing you want to remember. Notes can come later."
            : "A grouping for related topics."
        }
      >
        {(sheetState?.type === "create-subject" ||
          sheetState?.type === "edit-subject") && (
          <SubjectForm
            subject={
              sheetState.type === "edit-subject" ? sheetState.data : null
            }
            onSuccess={() => setSheetState(null)}
          />
        )}
        {(sheetState?.type === "create-topic" ||
          sheetState?.type === "edit-topic") && (
          <TopicForm
            topic={sheetState.type === "edit-topic" ? sheetState.data : null}
            subjects={subjects}
            defaultSubjectId={
              sheetState.type === "create-topic"
                ? sheetState.subjectId
                : undefined
            }
            onSuccess={() => setSheetState(null)}
          />
        )}
      </FormSheet>
    </ManagerWrapper>
  );
}
