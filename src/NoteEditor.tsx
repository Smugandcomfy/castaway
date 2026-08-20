import { useEffect, useRef, useState } from "react";
import { journalCache, loadJournal, setNote } from "./backend";

/// Per-entry note editor. Loads any existing note on mount; auto-saves on
/// blur or after a short debounce so quick edits don't lose keystrokes.
/// An empty note removes it rather than storing "".
export function NoteEditor({ entryId }: { entryId: string }) {
  const [body, setBody] = useState<string>("");
  const [open, setOpen] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let live = true;
    // The journal is already cached by the time the Journal page renders a
    // row, so this normally resolves without a round trip.
    const apply = (notes: { entryId: string; body: string }[]) => {
      const existing = notes.find((n) => n.entryId === entryId);
      if (live && existing) {
        setBody(existing.body);
        setOpen(true);
      }
    };
    const cached = journalCache();
    if (cached) apply(cached.notes);
    else void loadJournal().then((j) => apply(j.notes));
    return () => {
      live = false;
    };
  }, [entryId]);

  function schedule(next: string) {
    setBody(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void setNote(entryId, next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    }, 500);
  }

  function flush() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    void setNote(entryId, body);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="nt-button nt-button--ghost ca-note-add"
        onClick={() => setOpen(true)}
      >
        Add note
      </button>
    );
  }

  return (
    <div className="ca-note-editor">
      <textarea
        className="nt-textarea ca-note-textarea"
        rows={3}
        placeholder="Write about this reading..."
        value={body}
        onChange={(e) => schedule(e.target.value)}
        onBlur={flush}
        aria-label="Note for this entry"
      />
      <span className="ca-note-status">
        {saved ? "Saved" : body.length > 0 ? " " : "Notes are kept with the reading."}
      </span>
    </div>
  );
}
