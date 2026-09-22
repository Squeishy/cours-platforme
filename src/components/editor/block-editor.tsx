"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useEffect, useRef, useState, useTransition } from "react";
import { BlockNoteEditor, type PartialBlock } from "@blocknote/core";
import { fr } from "@blocknote/core/locales";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";

export type SaveResult = { ok: true } | { ok: false; error: string };
export type SaveContent = (content: unknown, markdown: string) => Promise<SaveResult>;

type Props = {
  /** Blocs BlockNote déjà enregistrés (JSON) */
  initialContent?: unknown;
  /** Markdown de repli si aucun bloc (ex. import BookStack) */
  initialMarkdown?: string | null;
  editable?: boolean;
  /** Server Action liée à la ressource ; absente = lecture seule */
  onSave?: SaveContent;
};

type Status = "idle" | "dirty" | "saving" | "saved" | "error";

const STATUS_LABEL: Record<Status, string> = {
  idle: "",
  dirty: "Modifications non enregistrées…",
  saving: "Enregistrement…",
  saved: "Enregistré",
  error: "Échec de l'enregistrement",
};

/**
 * Éditeur « à la Notion » : tapez « / » pour insérer un bloc,
 * le Markdown est reconnu à la frappe (#, -, 1., ```, >) et au collage.
 * Enregistre automatiquement 1 s après la dernière frappe.
 */
export default function BlockEditor({ initialContent, initialMarkdown, editable = false, onSave }: Props) {
  const canEdit = editable && !!onSave;
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Contenu uniquement en Markdown (import BookStack, seed) : conversion AVANT la création
  // de l'éditeur, pour qu'elle ne soit ni annulable (Ctrl+Z) ni enregistrée comme une modification.
  const [startBlocks] = useState<PartialBlock[] | undefined>(() => {
    if (Array.isArray(initialContent) && initialContent.length > 0) return initialContent as PartialBlock[];
    if (!initialMarkdown) return undefined;
    const blocks = BlockNoteEditor.create().tryParseMarkdownToBlocks(initialMarkdown);
    return blocks.length > 0 ? blocks : undefined;
  });

  const editor = useCreateBlockNote({ dictionary: fr, initialContent: startBlocks });

  // Ne pas perdre une frappe si on quitte la page avant l'autosave
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  function save() {
    if (!onSave) return;
    setStatus("saving");
    const blocks = editor.document;
    const markdown = editor.blocksToMarkdownLossy(blocks);
    startTransition(async () => {
      const res = await onSave(blocks, markdown);
      if (res.ok) {
        setStatus("saved");
        setError(null);
      } else {
        setStatus("error");
        setError(res.error);
      }
    });
  }

  function handleChange() {
    if (!canEdit) return;
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 1000);
  }

  return (
    <div className="rounded-md border border-line bg-surface">
      {canEdit && (
        <div className="flex min-h-9 items-center justify-between gap-2 border-b border-line px-3 text-sm text-muted">
          <span>Tapez « / » pour insérer un bloc — Markdown accepté</span>
          <span role="status" aria-live="polite" className={status === "error" ? "text-danger" : undefined}>
            {STATUS_LABEL[status]}
            {error ? ` : ${error}` : ""}
          </span>
        </div>
      )}
      <div className="py-4">
        <BlockNoteView editor={editor} editable={canEdit} onChange={handleChange} theme="light" />
      </div>
    </div>
  );
}
