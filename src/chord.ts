/**
 * A chord, spelled the way keymaps spell it — `Mod-Enter`, `Shift-Alt-k`, `ctrl+shift+k` — formatted
 * for a person. Which glyphs a keyboard has is a fact about the host, so the platform is an argument,
 * never read from `navigator`: this library sees no window.
 */
export type Platform = "mac" | "other"

type Modifier = "ctrl" | "alt" | "shift" | "meta"

/**
 * Modifier spellings, case-insensitive. `Mod` and `Cmd` mean the platform's primary modifier (⌘ on a
 * Mac, Ctrl elsewhere); `Meta` is the key itself. The one-letter forms are ProseMirror's and count
 * only before the last part, which is always the key: `Mod-s` is Mod with S, never Mod with Shift.
 */
const MODIFIERS: Readonly<Record<string, Modifier | "mod">> = {
  mod: "mod", cmd: "mod", command: "mod",
  meta: "meta", m: "meta", super: "meta", win: "meta",
  ctrl: "ctrl", control: "ctrl", c: "ctrl",
  alt: "alt", option: "alt", opt: "alt", a: "alt",
  shift: "shift", s: "shift",
}

/** Apple's order is ⌃⌥⇧⌘; elsewhere the same order reads Ctrl+Alt+Shift+Win. */
const ORDER: readonly Modifier[] = ["ctrl", "alt", "shift", "meta"]
const MAC_MOD: Readonly<Record<Modifier, string>> = { ctrl: "⌃", alt: "⌥", shift: "⇧", meta: "⌘" }
const OTHER_MOD: Readonly<Record<Modifier, string>> = { ctrl: "Ctrl", alt: "Alt", shift: "Shift", meta: "Win" }
const MAC_KEY: Readonly<Record<string, string>> = { Enter: "↵", Backspace: "⌫", Delete: "⌦", Escape: "⎋", Tab: "⇥", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" }

function modifierOf(part: string, platform: Platform): Modifier | undefined {
  const m = MODIFIERS[part.toLowerCase()]
  return m === "mod" ? (platform === "mac" ? "meta" : "ctrl") : m
}

/**
 * `Mod-Enter` → `⌘↵` on a Mac, `Ctrl+Enter` elsewhere. Parts split on `-` or `+`, except a trailing
 * one, which is the key itself: `Mod--` is Mod with minus, `Ctrl++` is Ctrl with plus. Modifiers are
 * put in the platform's order; a lone letter is upper-cased for display.
 */
export function formatChord(chord: string, platform: Platform = "other"): string {
  const parts = chord.split(/[-+](?!$)/)
  const key = parts.pop() ?? ""
  const held = new Set<Modifier>()
  for (const part of parts) {
    const m = modifierOf(part, platform)
    if (m) held.add(m)
  }
  const mods = ORDER.filter((m) => held.has(m))
  // A key named like a modifier (`Shift` pressed alone) is drawn as one; a single letter is a key.
  const keyMod = key.length > 1 ? modifierOf(key, platform) : undefined
  const table = platform === "mac" ? MAC_MOD : OTHER_MOD
  const face = keyMod ? table[keyMod] : (platform === "mac" ? MAC_KEY[key] : undefined) ?? (key.length === 1 ? key.toUpperCase() : key)
  if (platform === "mac") return mods.map((m) => table[m]).join("") + face
  return [...mods.map((m) => table[m]), face].filter(Boolean).join("+")
}
