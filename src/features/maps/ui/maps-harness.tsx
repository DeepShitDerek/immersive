"use client";

import { useEffect, useState } from "react";
import { emptyDocument } from "../domain/serialize";
import type { SaveOutcome, SaveRequest } from "../state/autosave";
import { MapEditor } from "./map-editor";

const KEY = "maps-harness";

interface Stored {
  name: string;
  doc: unknown;
  revision: number;
}

function read(): Stored {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Stored;
  } catch {
    // Fall through to a fresh map.
  }
  return { name: "Harness map", doc: emptyDocument(), revision: 0 };
}

/**
 * The editor with local-storage persistence and the same revision rule as
 * the database: a save naming a stale revision is a conflict.
 */
export function MapsHarness() {
  // Read after mount: the prerendered page has no local storage, and reading
  // it during the first render would make the client disagree with the HTML.
  const [initial, setInitial] = useState<Stored | null>(null);
  useEffect(() => setInitial(read()), []);

  const save = async (request: SaveRequest): Promise<SaveOutcome> => {
    const current = read();
    if (current.revision !== request.expectedRevision) {
      return { ok: false, conflict: true, message: "Changed in another tab." };
    }
    const next = {
      name: request.name,
      doc: request.doc,
      revision: current.revision + 1,
    };
    window.localStorage.setItem(KEY, JSON.stringify(next));
    return { ok: true, revision: next.revision };
  };

  if (!initial) return null;
  return (
    <div className="fixed inset-0">
      <MapEditor
        initial={initial}
        save={save}
        reload={async () => read()}
        onClose={() => window.location.reload()}
      />
    </div>
  );
}
