import type { DiscoverPlace, DiscoverTopic } from "@/types";
import type { WatchlistEntry } from "@/features/discover/watchlist";
import { adminApi } from "./baseApi";
import { getAllQueryFn, saveQueryFn, deleteQueryFn } from "./query-helpers";

/**
 * Discover's stored state — and only its stored state.
 *
 * Nothing fetched from a public service is cached here. A forecast has a
 * shelf life measured in minutes, and a cache would mean deciding when it goes
 * stale; a stale forecast is worse than none. RTK Query is holding the two
 * lists of *what to ask for*, and the components ask.
 */
const discoverApi = adminApi.injectEndpoints({
  endpoints: (builder) => ({
    getDiscoverPlaces: builder.query<DiscoverPlace[], void>({
      queryFn: getAllQueryFn<DiscoverPlace>("discover_places", [
        { column: "sort_order", ascending: true },
      ]),
      providesTags: ["Discover"],
    }),

    saveDiscoverPlace: builder.mutation<
      DiscoverPlace,
      Partial<DiscoverPlace> & { id?: string }
    >({
      queryFn: saveQueryFn<DiscoverPlace>("discover_places"),
      invalidatesTags: ["Discover"],
    }),

    deleteDiscoverPlace: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("discover_places"),
      invalidatesTags: ["Discover"],
    }),

    getDiscoverTopics: builder.query<DiscoverTopic[], void>({
      queryFn: getAllQueryFn<DiscoverTopic>("discover_topics", [
        { column: "sort_order", ascending: true },
      ]),
      providesTags: ["Discover"],
    }),

    saveDiscoverTopic: builder.mutation<
      DiscoverTopic,
      Partial<DiscoverTopic> & { id?: string }
    >({
      queryFn: saveQueryFn<DiscoverTopic>("discover_topics"),
      invalidatesTags: ["Discover"],
    }),

    deleteDiscoverTopic: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("discover_topics"),
      invalidatesTags: ["Discover"],
    }),

    /**
     * The watchlist — again, only what to ask for. No quote is ever stored:
     * caching a price means deciding when it goes stale, and a stale price
     * shown as current is the one thing a money screen must not do.
     */
    getWatchlist: builder.query<WatchlistEntry[], void>({
      queryFn: getAllQueryFn<WatchlistEntry>("discover_watchlist", [
        { column: "display_order", ascending: true },
        { column: "symbol", ascending: true },
      ]),
      providesTags: ["Discover"],
    }),

    saveWatchlistEntry: builder.mutation<
      WatchlistEntry,
      Partial<WatchlistEntry> & { id?: string }
    >({
      queryFn: saveQueryFn<WatchlistEntry>("discover_watchlist"),
      invalidatesTags: ["Discover"],
    }),

    deleteWatchlistEntry: builder.mutation<{ id: string }, string>({
      queryFn: deleteQueryFn("discover_watchlist"),
      invalidatesTags: ["Discover"],
    }),
  }),
});

export const {
  useGetDiscoverPlacesQuery,
  useSaveDiscoverPlaceMutation,
  useDeleteDiscoverPlaceMutation,
  useGetDiscoverTopicsQuery,
  useSaveDiscoverTopicMutation,
  useDeleteDiscoverTopicMutation,
  useGetWatchlistQuery,
  useSaveWatchlistEntryMutation,
  useDeleteWatchlistEntryMutation,
} = discoverApi;
