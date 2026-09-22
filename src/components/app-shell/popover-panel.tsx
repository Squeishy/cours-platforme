"use client";

import { useRef, type ReactNode } from "react";

/**
 * Panneau « popover » natif (tiroir mobile, menu utilisateur) : Échap et clic extérieur
 * le ferment nativement ; on le referme aussi quand un lien est suivi (la coquille ne se
 * redémonte pas entre deux pages). Ouvert par un <button popoverTarget={id}>.
 * Non modal : pas de role="dialog" ; il se referme quand le focus clavier le quitte
 * (sinon, en mobile, le focus passerait sous le tiroir — WCAG 2.4.3 / 2.4.11).
 */
export function PopoverPanel({
  id,
  label,
  className,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function closeOnLink(target: EventTarget) {
    const el = ref.current;
    if (!el || !(target instanceof Element) || !target.closest("a[href]"))
      return;
    try {
      if (el.matches(":popover-open")) el.hidePopover();
    } catch {
      // Navigateur sans API Popover : rien à fermer
    }
  }

  function closeOnFocusLeave(next: EventTarget | null) {
    const el = ref.current;
    if (!el || (next instanceof Node && el.contains(next))) return;
    // Le bouton d'ouverture gère lui-même la bascule
    if (next instanceof Element && next.getAttribute("popovertarget") === id)
      return;
    try {
      if (el.matches(":popover-open")) el.hidePopover();
    } catch {
      // Navigateur sans API Popover
    }
  }

  return (
    <div
      ref={ref}
      id={id}
      popover="auto"
      role="group"
      aria-label={label}
      className={className}
      onClick={(e) => closeOnLink(e.target)}
      onBlur={(e) => closeOnFocusLeave(e.relatedTarget)}
    >
      {children}
    </div>
  );
}
