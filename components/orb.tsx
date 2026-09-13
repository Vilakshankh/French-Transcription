"use client";

import { cn } from "@/lib/utils";

/**
 * Small animated "thinking" orb: a slowly rotating conic gradient under a soft radial glow,
 * with a gentle breathing scale. Used while a translation is loading.
 */
export function Orb({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      data-slot="orb"
      className={cn("relative inline-block shrink-0 rounded-full", className)}
      style={{ width: size, height: size }}
    >
      <span
        className="absolute inset-0 rounded-full opacity-90 motion-safe:animate-[orb-spin_2.4s_linear_infinite]"
        style={{
          background: "conic-gradient(from 0deg, #60a5fa, #a78bfa, #f472b6, #fb923c, #facc15, #34d399, #60a5fa)",
          filter: "blur(1px)",
        }}
      />
      <span
        className="absolute inset-[18%] rounded-full motion-safe:animate-[orb-breathe_1.8s_ease-in-out_infinite]"
        style={{ background: "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.95), rgba(255,255,255,0.35) 55%, rgba(255,255,255,0) 75%)" }}
      />
      <span className="absolute -inset-1 rounded-full bg-blue-400/30 blur-md motion-safe:animate-[orb-breathe_1.8s_ease-in-out_infinite]" />
    </span>
  );
}
