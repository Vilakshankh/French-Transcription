"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, PlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface TranslateTarget {
  text: string;
  context?: string;
  /** Viewport-relative rectangle of the hovered word or selection. */
  rect: DOMRect;
}

export interface TranslateResult {
  translation?: string;
  note?: string;
  error?: string;
}

const clientCache = new Map<string, Promise<TranslateResult>>();

function lookup(text: string, context?: string): Promise<TranslateResult> {
  const key = `${text.toLowerCase()}|${context ?? ""}`;
  const cached = clientCache.get(key);
  if (cached) return cached;
  const params = new URLSearchParams({ q: text });
  if (context) params.set("context", context);
  const promise = fetch(`/api/translate?${params}`)
    .then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { error: body.error ?? `Request failed (${res.status})` } as TranslateResult;
      return { translation: body.translation as string, note: body.note as string | undefined };
    })
    .catch((err: Error) => ({ error: err.message }) as TranslateResult);
  clientCache.set(key, promise);
  promise.then((r) => {
    if (r.error) clientCache.delete(key); // let the user retry after a failure
  });
  return promise;
}

const GAP = 8;

interface Props {
  target: TranslateTarget | null;
  /** Whether the target's French text is already in the vocabulary list. */
  saved: boolean;
  onAdd: (french: string, result: TranslateResult) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/** Small tooltip that shows the English meaning of a French word or phrase, with an "Add" button. */
export function TranslatePopover({ target, saved, onAdd, onMouseEnter, onMouseLeave }: Props) {
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target) {
      setResult(null);
      setPos(null);
      return;
    }
    let cancelled = false;
    setResult(null);
    lookup(target.text, target.context).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [target]);

  // Position after render so we know the tooltip's own size.
  useEffect(() => {
    const el = ref.current;
    if (!target || !el) return;
    const { rect } = target;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const below = rect.top - height - GAP < 4;
    const top = below ? rect.bottom + GAP : rect.top - height - GAP;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
    setPos({ top, left });
  }, [target, result, saved]);

  if (!target) return null;

  return (
    <div
      ref={ref}
      role="tooltip"
      data-slot="translate-popover"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "fixed z-50 min-w-44 max-w-80 rounded-lg bg-foreground px-3.5 py-2.5 text-background shadow-lg",
        "animate-in fade-in-0 zoom-in-95 duration-100",
        pos ? "visible" : "invisible",
      )}
      style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0 }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="truncate text-[13px] font-medium text-background/70">{target.text}</div>
        {result?.translation && (
          <button
            type="button"
            data-slot="vocab-add"
            disabled={saved}
            onClick={() => onAdd(target.text, result)}
            aria-label={saved ? "Saved to vocabulary" : "Add to vocabulary"}
            title={saved ? "Saved to vocabulary" : "Add to vocabulary"}
            className={cn(
              "inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors",
              saved ? "bg-background/10 text-background/70" : "bg-background/15 text-background hover:bg-background/25",
            )}
          >
            {saved ? <CheckIcon className="size-3.5" /> : <PlusIcon className="size-3.5" />}
          </button>
        )}
      </div>
      <div className="mt-2">
        {!result && <div className="text-[13px] text-background/80">Translating…</div>}
        {result?.error && <div className="text-[13px] text-destructive-foreground/90">{result.error}</div>}
        {result?.translation && (
          <>
            <div className="text-[15px] font-medium leading-snug">{result.translation}</div>
            {result.note && <div className="mt-0.5 text-xs text-background/70">{result.note}</div>}
          </>
        )}
      </div>
    </div>
  );
}
