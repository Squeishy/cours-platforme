"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type MouseEvent } from "react";

type Props = {
  prevHref: string | null;
  nextHref: string | null;
  position: number;
  total: number;
  label: string;
  /** Une seule instance écoute le clavier (j / k) et affiche l'interrupteur */
  shortcuts?: boolean;
};

// ── Préférence « raccourcis clavier » (WCAG 2.1.4 : désactivables) ──
const STORAGE_KEY = "review-queue-shortcuts";
const listeners = new Set<() => void>();
let memoryValue = true;

function readEnabled() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? memoryValue : stored !== "off";
  } catch {
    return memoryValue;
  }
}

function writeEnabled(value: boolean) {
  memoryValue = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
  } catch {
    // stockage indisponible (navigation privée) : on garde la valeur en mémoire
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Saisie en cours : champs texte, zones de texte, listes, contenu éditable */
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
    return true;
  if (target instanceof HTMLInputElement) {
    return !["radio", "checkbox", "button", "submit", "reset"].includes(
      target.type,
    );
  }
  return false;
}

/** Le formulaire de positionnement signale ses modifications non enregistrées par data-dirty */
function confirmLeave() {
  if (!document.querySelector('form[data-dirty="true"]')) return true;
  return window.confirm(
    "Des modifications non enregistrées seront perdues. Continuer ?",
  );
}

export function QueueNav({
  prevHref,
  nextHref,
  position,
  total,
  label,
  shortcuts = false,
}: Props) {
  const router = useRouter();
  const enabled = useSyncExternalStore(subscribe, readEnabled, () => true);

  useEffect(() => {
    if (!shortcuts || !enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.repeat
      )
        return;
      if (isTyping(event.target)) return;
      const href =
        event.key === "j" ? nextHref : event.key === "k" ? prevHref : null;
      if (!href) return;
      event.preventDefault();
      if (confirmLeave()) router.push(href);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcuts, enabled, nextHref, prevHref, router]);

  function guard(event: MouseEvent<HTMLAnchorElement>) {
    if (!confirmLeave()) event.preventDefault();
  }

  return (
    <div className="flex flex-col gap-2">
      <nav
        aria-label={label}
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"
      >
        {prevHref ? (
          <Link
            href={prevHref}
            onClick={guard}
            className="btn justify-self-start"
            rel="prev"
          >
            <span aria-hidden="true">←</span> Précédent
          </Link>
        ) : (
          <span
            className="btn justify-self-start opacity-50"
            aria-disabled="true"
          >
            <span aria-hidden="true">←</span> Précédent
            <span className="sr-only">
              {" "}
              (aucune auto-évaluation précédente)
            </span>
          </span>
        )}
        <p className="font-mono text-sm tabular-nums">
          <span className="sr-only">Auto-évaluation </span>
          {position} / {total}
        </p>
        {nextHref ? (
          <Link
            href={nextHref}
            onClick={guard}
            className="btn justify-self-end"
            rel="next"
          >
            Suivant <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <span
            className="btn justify-self-end opacity-50"
            aria-disabled="true"
          >
            Suivant <span aria-hidden="true">→</span>
            <span className="sr-only"> (aucune auto-évaluation suivante)</span>
          </span>
        )}
      </nav>
      {shortcuts && (
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-start text-sm text-muted">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => writeEnabled(e.target.checked)}
            className="size-5 accent-accent"
          />
          Raccourcis clavier : <kbd className="font-mono">j</kbd> suivant,{" "}
          <kbd className="font-mono">k</kbd> précédent
        </label>
      )}
    </div>
  );
}
