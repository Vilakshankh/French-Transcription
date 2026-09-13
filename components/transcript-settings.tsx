"use client";

import { SettingsIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { TranscriptSettings } from "@/hooks/use-settings";

interface Props {
  settings: TranscriptSettings;
  onChange: <K extends keyof TranscriptSettings>(key: K, value: TranscriptSettings[K]) => void;
}

const OPTIONS: { key: keyof TranscriptSettings; label: string; description: string }[] = [
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
