import { supabase } from "@/supabase/client";
import type {
  LearningReview,
  LearningReviewRating,
  LearningSession,
  LearningSubject,
  LearningTopic,
} from "@/types";
import { adminApi } from "./baseApi";
import {
  NO_DB_ERROR,
  insertQueryFn,
  updateQueryFn,
  saveQueryFn,
  deleteQueryFn,
} from "./query-helpers";

export const learningApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    getLearningData: builder.query<
      {
        subjects: LearningSubject[];
        topics: LearningTopic[];
        sessions: LearningSession[];
        reviews: LearningReview[];
      },
      void
    >({
      queryFn: async () => {
        if (!supabase) return { error: NO_DB_ERROR };
        const [subjectsRes, topicsRes, sessionsRes, reviewsRes] =
          await Promise.all([
            supabase
              .from("learning_subjects")
              .select("*")
              .order("display_order")
              .order("name"),
            supabase
              .from("learning_topics")
              .select("*")
              .order("display_order")
              .order("title"),
            supabase
              .from("learning_sessions")
              .select("*")
              .order("start_time", { ascending: false })
              .limit(200),
            // Enough history to compute retention over a meaningful window.
            supabase
              .from("learning_reviews")
              .select("*")
              .order("reviewed_at", { ascending: false })
              .limit(500),
          ]);
        const error =
          subjectsRes.error ||
          topicsRes.error ||
          sessionsRes.error ||
          reviewsRes.error;
        if (error) return { error };
        return {
          data: {
            subjects: subjectsRes.data,
            topics: topicsRes.data,
            sessions: sessionsRes.data,
            reviews: reviewsRes.data,
          },
        };
      },
      providesTags: ["Learning"],
    }),
    addLearningSession: builder.mutation<
      LearningSession,
      Partial<LearningSession>
    >({
      queryFn: insertQueryFn<LearningSession>("learning_sessions"),
      invalidatesTags: ["Learning"],
    }),
    updateLearningSession: builder.mutation<
      LearningSession,
      Partial<LearningSession>
    >({
      queryFn: updateQueryFn<LearningSession>("learning_sessions"),
      invalidatesTags: ["Learning"],
    }),
    deleteLearningSession: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("learning_sessions"),
      invalidatesTags: ["Learning"],
    }),
    saveSubject: builder.mutation<LearningSubject, Partial<LearningSubject>>({
      queryFn: saveQueryFn<LearningSubject>("learning_subjects"),
      invalidatesTags: ["Learning"],
    }),
    deleteSubject: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("learning_subjects"),
      invalidatesTags: ["Learning"],
    }),
    saveTopic: builder.mutation<LearningTopic, Partial<LearningTopic>>({
      queryFn: saveQueryFn<LearningTopic>("learning_topics"),
      invalidatesTags: ["Learning"],
    }),
    deleteTopic: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("learning_topics"),
      invalidatesTags: ["Learning"],
    }),
    /**
     * Rate a recall attempt. The database computes the next interval, so a
     * review and the topic state it produces cannot disagree — the client
     * sends a rating, never a schedule.
     */
    recordReview: builder.mutation<
      LearningTopic,
      { topic_id: string; rating: LearningReviewRating }
    >({
      queryFn: async ({ topic_id, rating }) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { data, error } = await supabase.rpc("record_learning_review", {
          target_topic_id: topic_id,
          new_rating: rating,
        });
        if (error) return { error };
        return { data: data as LearningTopic };
      },
      invalidatesTags: ["Learning"],
    }),
    archiveTopic: builder.mutation<null, { id: string; archived: boolean }>({
      queryFn: async ({ id, archived }) => {
        if (!supabase) return { error: NO_DB_ERROR };
        const { error } = await supabase
          .from("learning_topics")
          .update({ archived_at: archived ? new Date().toISOString() : null })
          .eq("id", id);
        if (error) return { error };
        return { data: null };
      },
      invalidatesTags: ["Learning"],
    }),
  }),
});

export const {
  useGetLearningDataQuery,
  useAddLearningSessionMutation,
  useUpdateLearningSessionMutation,
  useDeleteLearningSessionMutation,
  useSaveSubjectMutation,
  useDeleteSubjectMutation,
  useSaveTopicMutation,
  useDeleteTopicMutation,
  useRecordReviewMutation,
  useArchiveTopicMutation,
} = learningApi;
