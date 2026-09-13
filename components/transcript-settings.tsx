"use client";

import { SettingsIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { TEXT_SIZES, type TranscriptSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

interface Props {
  settings: TranscriptSettings;
  onChange: <K extends keyof TranscriptSettings>(key: K, value: TranscriptSettings[K]) => void;
}

const OPTIONS: { key: "stream" | "autoScroll" | "hoverTranslate"; label: string; description: string }[] = [
  { key: "stream", label: "Stream", description: "Reveal words as they are spoken." },
  { key: "autoScroll", label: "Auto-scroll", description: "Keep the current line in view." },
  { key: "hoverTranslate", label: "Hover translate", description: "Show the English meaning when hovering a word." },
];

export function TranscriptSettingsPanel({ settings, onChange }: Props) {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Transcript settings" />}>
        <SettingsIcon />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72" data-slot="transcript-settings">
        <PopoverHeader>
          <PopoverTitle>Transcript settings</PopoverTitle>
        </PopoverHeader>
        <Separator />
        <div className="flex flex-col gap-3">
          {OPTIONS.map((option) => (
            <Label key={option.key} className="flex cursor-pointer items-start justify-between gap-4">
              <span className="flex flex-col gap-0.5">
                <span>{option.label}</span>
                <span className="text-xs font-normal text-muted-foreground">{option.description}</span>
              </span>
              <Switch
                checked={settings[option.key]}
                onCheckedChange={(checked) => onChange(option.key, checked)}
                aria-label={option.label}
                data-setting={option.key}
              />
            </Label>
          ))}
          <div className="flex items-start justify-between gap-4">
            <span className="flex flex-col gap-0.5 text-sm font-medium">
              <span>Text size</span>
              <span className="text-xs font-normal text-muted-foreground">Size of the transcript text.</span>
            </span>
            <div role="radiogroup" aria-label="Text size" className="inline-flex shrink-0 rounded-lg bg-muted p-0.5" data-slot="text-size">
              {TEXT_SIZES.map((size) => {
                const active = settings.textSize === size.value;
                return (
                  <button
                    key={size.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`${size.label} text`}
                    onClick={() => onChange("textSize", size.value)}
                    className={cn(
                      "rounded-md px-2 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      size.value === "sm" && "text-xs",
                      size.value === "md" && "text-sm",
                      size.value === "lg" && "text-base",
                      active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    A
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
