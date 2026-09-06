/**
 * A chord, spelled the way keymaps spell it — `Mod-Enter`, `Shift-Alt-k` — formatted for a person.
 * Which glyphs a keyboard has is a fact about the host, so the platform is an argument, never read
 * from `navigator`: this library sees no window.
 */
export type Platform = "mac" | "other"

const MAC: Readonly<Record<string, string>> = { Mod: "⌘", Cmd: "⌘", Meta: "⌘", Ctrl: "⌃", Alt: "⌥", Shift: "⇧", Enter: "↵", Backspace: "⌫", Delete: "⌦", Escape: "⎋", Tab: "⇥", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" }
const OTHER: Readonly<Record<string, string>> = { Mod: "Ctrl", Cmd: "Ctrl", Meta: "Win" }

/** `Mod-Enter` → `⌘↵` on a Mac, `Ctrl+Enter` elsewhere. A lone letter is upper-cased for display. */
export function formatChord(chord: string, platform: Platform = "other"): string {
  const parts = chord.split("-").filter(Boolean)
  if (platform === "mac") return parts.map((p) => MAC[p] ?? (p.length === 1 ? p.toUpperCase() : p)).join("")
  return parts.map((p) => OTHER[p] ?? (p.length === 1 ? p.toUpperCase() : p)).join("+")
}
