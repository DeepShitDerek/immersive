import { supabase } from "@/supabase/client";
import { config } from "@/lib/config";
import { BUCKET_NAME } from "./asset-utils";

/**
 * Uploading with a progress figure, which the SDK cannot give.
 *
 * `supabase-js` v2 uploads through `fetch`, and `fetch` has no upload-progress
 * event — the Streams-based request body that would allow one is not supported
 * for uploads in any shipping browser. So a 40 MB video through the SDK is a
 * spinner and nothing else, which is what was reported.
 *
 * `XMLHttpRequest` does have `upload.onprogress`, and Storage's REST endpoint
 * is the same one the SDK posts to. This is therefore *not* a workaround
 * around the SDK's rules — same URL, same bucket, same auth — only a different
 * transport for the one request whose progress matters.
 *
 * The trade is explicit: this hand-rolls what the SDK does for us, so it has
 * to reproduce the auth header and the error shape itself. `uploadFile` below
 * falls back to the SDK when anything about the XHR path is unavailable, so a
 * missing session or a blocked XHR costs the progress bar rather than the
 * upload.
 */

export interface UploadProgress {
  /** Bytes sent so far. */
  loaded: number;
  /** Total bytes, when the browser reports a computable length. */
  total: number;
}

type UploadStage = "queued" | "uploading" | "saving" | "done" | "failed";

export interface UploadTask {
  id: string;
  name: string;
  size: number;
  stage: UploadStage;
  loaded: number;
  error?: string;
}

/** 0–1 across a whole batch, weighted by size rather than by file count. */
export function batchProgress(tasks: UploadTask[]): number {
  const total = tasks.reduce((sum, task) => sum + task.size, 0);
  if (total <= 0) return tasks.every((task) => task.stage === "done") ? 1 : 0;

  const done = tasks.reduce(
    (sum, task) =>
      // A finished file counts whole even if its last progress event never
      // arrived; browsers do not always fire a final 100% tick.
      sum +
      (task.stage === "done" ? task.size : Math.min(task.loaded, task.size)),
    0,
  );

  return Math.min(done / total, 1);
}

/** "1.4 MB of 12 MB" — the sentence a progress bar needs beside it. */
export function describeProgress(task: UploadTask): string {
  if (task.stage === "failed") return task.error ?? "Failed";
  if (task.stage === "queued") return "Waiting";
  if (task.stage === "saving") return "Saving";
  if (task.stage === "done") return formatBytes(task.size);
  return `${formatBytes(task.loaded)} of ${formatBytes(task.size)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * PUT one file to Storage's REST endpoint, reporting bytes as they go.
 *
 * Resolves `false` when the XHR path is not usable at all — no session, no
 * configured URL — so the caller can fall back rather than fail.
 */
interface XhrCredentials {
  token: string;
  url: string;
  anonKey: string;
}

/**
 * What the direct PUT needs, or null.
 *
 * Separated from the request itself, and deliberately swallowing everything:
 * failing to *prepare* the fast path is not an upload failure, it is a reason
 * to use the slow one. Conflating the two made a missing auth object — which
 * is simply how the client is shaped under test — look like a broken upload.
 */
async function xhrCredentials(): Promise<XhrCredentials | null> {
  try {
    if (!supabase?.auth || typeof XMLHttpRequest === "undefined") return null;

    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    const { url, anonKey } = config.supabase;

    if (!token || !url || !anonKey) return null;
    return { token, url, anonKey };
  } catch {
    return null;
  }
}

function putWithProgress(
  { token, url, anonKey }: XhrCredentials,
  path: string,
  file: File,
  onProgress: (progress: UploadProgress) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(
      "POST",
      `${url}/storage/v1/object/${BUCKET_NAME}/${path}`,
      true,
    );
    request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.setRequestHeader("apikey", anonKey);
    // The SDK sends this; without it a repeated name overwrites silently.
    request.setRequestHeader("x-upsert", "false");
    if (file.type) request.setRequestHeader("Content-Type", file.type);

    request.upload.onprogress = (event) => {
      // `lengthComputable` is false for a stream the browser cannot measure.
      // Reporting a made-up total would move the bar without meaning anything.
      if (event.lengthComputable) {
        onProgress({ loaded: event.loaded, total: event.total });
      }
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }
      // Storage answers with JSON on failure; fall back to the status text
      // when it does not, rather than showing "[object Object]".
      let message = `Upload failed (${request.status})`;
      try {
        const body = JSON.parse(request.responseText) as { message?: string };
        if (body.message) message = body.message;
      } catch {
        /* Not JSON. The status is what we have. */
      }
      reject(new Error(message));
    };

    request.onerror = () =>
      reject(new Error("The upload could not reach the server."));
    request.onabort = () => reject(new Error("Upload cancelled."));

    request.send(file);
  });
}

/**
 * Upload one file, with progress where the browser can report it.
 *
 * Falls back to the SDK when the XHR path is unavailable — the upload still
 * happens, the bar just jumps from nothing to done. Losing a progress figure
 * is a far smaller failure than losing the ability to upload.
 */
export async function uploadFile(
  path: string,
  file: File,
  onProgress: (progress: UploadProgress) => void,
): Promise<void> {
  const credentials = await xhrCredentials();

  if (credentials) {
    // A rejection from here is the server's answer, not a reason to retry
    // through a second path that would be rejected identically.
    await putWithProgress(credentials, path, file, onProgress);
    return;
  }

  if (!supabase) throw new Error("Database not configured.");
  const { error } = await supabase.storage.from(BUCKET_NAME).upload(path, file);
  if (error) throw error;
}
