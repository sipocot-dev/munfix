"use client";

import { useEffect, useId, useState } from "react";
import { applyThemePref, type ThemePref } from "@/lib/theme";
import Icon, { type IconName } from "./ui/Icon";

const OPTIONS: [ThemePref, string, IconName][] = [
  ["light", "Light", "sun"],
  ["dark", "Dark", "moon"],
  ["system", "System", "monitor"],
];

/** Light / Dark / System. A native radio group, so arrow keys move between the options. */
export default function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const name = useId();
  // Read after mount: the server cannot know the stored preference.
  const [pref, setPref] = useState<ThemePref | null>(null);
  useEffect(() => setPref((document.documentElement.dataset.themePref as ThemePref) || "system"), []);

  return (
    <fieldset className="inline-flex">
      <legend className={compact ? "sr-only" : "mb-1.5 text-sm font-semibold text-fg"}>Theme</legend>
      <div className="inline-flex rounded-lg border border-line-strong bg-surface p-0.5">
        {OPTIONS.map(([value, label, icon]) => (
          <label
            key={value}
            title={compact ? label : undefined}
            className={`relative flex cursor-pointer items-center gap-1.5 rounded-md text-sm font-medium text-fg-muted hover:text-fg has-[:checked]:bg-accent-soft has-[:checked]:text-accent-strong has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus ${compact ? "h-8 w-8 justify-center" : "h-9 px-3"}`}
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={pref === value}
              onChange={() => {
                applyThemePref(value);
                setPref(value);
              }}
              className="sr-only"
            />
            <Icon name={icon} className="h-4 w-4" />
            <span className={compact ? "sr-only" : ""}>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
