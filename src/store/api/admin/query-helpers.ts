import { supabase } from "@/supabase/client";
import type { ApiError } from "@/types";

/**
 * Typed `queryFn` factories for the standard Supabase CRUD shapes that repeat
 * across admin endpoints. Each returns a function suitable for RTK Query's
 * `queryFn` option; result/arg types flow from the generic, so hooks stay
 * fully typed. Endpoints with joins, storage side-effects, or RPCs keep
 * hand-written queryFns in their feature file.
 */

export const NO_DB_ERROR: ApiError = { message: "No DB" };

type QueryFnResult<T> = { data: T } | { error: ApiError };

interface OrderBy {
  column: string;
  ascending?: boolean;
}

/** Fetch all rows of a table, with optional ordering. */
export function getAllQueryFn<T>(tableName: string, orderBy: OrderBy[] = []) {
  return async (): Promise<QueryFnResult<T[]>> => {
    if (!supabase) return { error: NO_DB_ERROR };
    let query = supabase.from(tableName).select("*");
    for (const order of orderBy) {
      query = query.order(order.column, {
        ascending: order.ascending ?? true,
      });
    }
    const { data, error } = await query;
    if (error) return { error };
    return { data: data as T[] };
  };
}

/** Insert a row and return the created entity. */
export function insertQueryFn<T>(tableName: string) {
  return async (entity: Partial<T>): Promise<QueryFnResult<T>> => {
    if (!supabase) return { error: NO_DB_ERROR };
    const { data, error } = await supabase
      .from(tableName)
      .insert(entity)
      .select()
      .single();
    if (error) return { error };
    return { data: data as T };
  };
}

/** Update a row by its `id` and return the updated entity. */
export function updateQueryFn<T extends { id?: string }>(tableName: string) {
  return async (entity: Partial<T>): Promise<QueryFnResult<T>> => {
    if (!supabase) return { error: NO_DB_ERROR };
    const { id, ...updateData } = entity;
    const { data, error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq("id", id!)
      .select()
      .single();
    if (error) return { error };
    return { data: data as T };
  };
}

/** Upsert: update when the entity has an `id`, insert otherwise. */
export function saveQueryFn<T extends { id?: string }>(tableName: string) {
  return async (entity: Partial<T>): Promise<QueryFnResult<T>> => {
    if (!supabase) return { error: NO_DB_ERROR };
    const { id, ...updateData } = entity;
    const query = id
      ? supabase.from(tableName).update(updateData).eq("id", id)
      : supabase.from(tableName).insert(updateData);
    const { data, error } = await query.select().single();
    if (error) return { error };
    return { data: data as T };
  };
}

/** Delete a row by id; resolves with `{ id }` for cache updates. */
export function deleteQueryFn(tableName: string) {
  return async (id: string): Promise<QueryFnResult<{ id: string }>> => {
    if (!supabase) return { error: NO_DB_ERROR };
    const { error } = await supabase.from(tableName).delete().eq("id", id);
    if (error) return { error };
    return { data: { id } };
  };
}
