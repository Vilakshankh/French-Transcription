"use client";

import { DownloadIcon, Trash2Icon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { vocabularyToCsv, type VocabEntry } from "@/lib/vocabulary";
import { formatTime } from "@/lib/youtube";

interface Props {
  entries: VocabEntry[];
  currentVideoId: string;
  onRemove: (id: string) => void;
  onClear: () => void;
  onSeek: (seconds: number) => void;
  className?: string;
}

function exportCsv(entries: VocabEntry[]) {
  const blob = new Blob([vocabularyToCsv(entries)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vocabulary.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function VocabularyPanel({ entries, currentVideoId, onRemove, onClear, onSeek, className }: Props) {
  return (
    <Card className={cn("flex flex-col gap-0 py-0", className)} data-slot="vocabulary-panel">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="font-heading text-sm font-medium">Vocabulary</span>
        <Badge variant="secondary">{entries.length}</Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Export vocabulary as CSV" disabled={!entries.length} onClick={() => exportCsv(entries)}>
            <DownloadIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Clear vocabulary"
            disabled={!entries.length}
            onClick={() => {
              if (window.confirm("Remove all saved vocabulary?")) onClear();
            }}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>
      <Separator />

      <div className="grid grid-cols-[1fr_1fr_auto] gap-x-3 px-4 py-2 text-xs font-medium text-muted-foreground">
        <span>Français</span>
        <span>English</span>
        <span className="w-7" aria-hidden="true" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground text-balance">
            Hover a word in the transcript and press <span className="font-medium text-foreground">Add</span> to build your list.
          </p>
        ) : (
          <ul className="divide-y">
            {entries.map((entry) => {
              const canSeek = entry.videoId === currentVideoId && typeof entry.time === "number";
              return (
                <li key={entry.id} className="grid grid-cols-[1fr_1fr_auto] items-start gap-x-3 px-4 py-2 text-sm" data-slot="vocab-row">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => canSeek && onSeek(entry.time!)}
                      disabled={!canSeek}
                      title={canSeek ? `Jump to ${formatTime(entry.time!)}` : undefined}
                      className={cn(
                        "max-w-full truncate text-left font-medium",
                        canSeek && "cursor-pointer hover:underline hover:underline-offset-4 hover:decoration-dotted",
                      )}
                    >
                      {entry.french}
                    </button>
                    {typeof entry.time === "number" && (
                      <div className="font-mono text-[11px] tabular-nums text-muted-foreground">{formatTime(entry.time)}</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="break-words">{entry.english}</div>
                    {entry.note && <div className="text-xs text-muted-foreground">{entry.note}</div>}
                  </div>
                  <Button variant="ghost" size="icon-xs" aria-label={`Remove ${entry.french}`} onClick={() => onRemove(entry.id)}>
                    <XIcon />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
