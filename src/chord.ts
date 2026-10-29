import type { Register } from "./register.ts"
import type { Attributed } from "./taste.ts"

/**
 * A chord, spelled the way keymaps spell it — `Mod-Enter`, `Shift-Alt-k`, `ctrl+shift+k` — drawn
 * for a person and matched against a key press. Which glyphs a keyboard has and which modifier is
 * primary are facts about the host, so the platform is an argument, never read from `navigator`:
 * this library sees no window, and a key press is anything shaped like one.
 */
export type Platform = "mac" | "other"

export type Modifier = "ctrl" | "alt" | "shift" | "meta"

/** A chord, resolved for a platform: which modifiers it holds and which key it presses. */
export interface Chord {
  readonly mods: ReadonlySet<Modifier>
  /** The key as written: `Enter`, `k`, `-`. */
  readonly key: string
}

/** Anything shaped like a `KeyboardEvent`. `code` is optional and used only as a fallback. */
export interface KeyPress {
  readonly key: string
  readonly code?: string
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
  readonly metaKey: boolean
}

/**
 * Modifier spellings, case-insensitive. `Mod` and `Cmd` mean the platform's primary modifier (⌘ on a
 * Mac, Ctrl elsewhere), as do Electron's `CommandOrControl` and `CmdOrCtrl`; `Meta` is the key itself.
 * The one-letter forms are ProseMirror's and count only before the last part, which is always the
 * key: `Mod-s` is Mod with S, never Mod with Shift.
 */
const MODIFIERS: Readonly<Record<string, Modifier | "mod">> = {
  mod: "mod", cmd: "mod", command: "mod", commandorcontrol: "mod", cmdorctrl: "mod",
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
/** Key names as keymaps write them, mapped to what a key press reports, lower-cased. */
const KEY_ALIASES: Readonly<Record<string, string>> = { space: " ", spacebar: " ", esc: "escape", del: "delete", return: "enter", up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright", plus: "+", minus: "-" }

function modifierOf(part: string, platform: Platform): Modifier | undefined {
  const m = MODIFIERS[part.toLowerCase()]
  return m === "mod" ? (platform === "mac" ? "meta" : "ctrl") : m
}

/**
 * Read a chord for a platform. Parts split on `-` or `+`, except a trailing one, which is the key
 * itself: `Mod--` is Mod with minus, `Ctrl++` is Ctrl with plus. Any other part must be a modifier;
 * one that is not (`Hyper-t`, `Cmmand-t`) is refused here, so a misspelling fails at build, not at a
 * key press.
 */
export function parseChord(chord: string, platform: Platform = "other"): Chord {
  const parts = chord.split(/[-+](?!$)/)
  const key = parts.pop() ?? ""
  const mods = new Set<Modifier>()
  for (const part of parts) {
    const m = modifierOf(part, platform)
    if (!m) throw new Error(`chord "${chord}" has unknown modifier "${part}"`)
    mods.add(m)
  }
  return { mods, key }
}

/**
 * `Mod-Enter` → `⌘↵` on a Mac, `Ctrl+Enter` elsewhere. Modifiers are put in the platform's order; a
 * lone letter is upper-cased for display.
 */
export function formatChord(chord: string, platform: Platform = "other"): string {
  const { mods, key } = parseChord(chord, platform)
  const held = ORDER.filter((m) => mods.has(m))
  // A key named like a modifier (`Shift` pressed alone) is drawn as one; a single letter is a key.
  const keyMod = key.length > 1 ? modifierOf(key, platform) : undefined
  const table = platform === "mac" ? MAC_MOD : OTHER_MOD
  const face = keyMod ? table[keyMod] : (platform === "mac" ? MAC_KEY[macKeyName(key)] : undefined) ?? (key.length === 1 ? key.toUpperCase() : key)
  if (platform === "mac") return held.map((m) => table[m]).join("") + face
  return [...held.map((m) => table[m]), face].filter(Boolean).join("+")
}

function canonKey(key: string): string {
  const lower = key.toLowerCase()
  return KEY_ALIASES[lower] ?? lower
}

/** The {@link MAC_KEY} name an alias stands for, so `Left` draws as `←` like `ArrowLeft`. */
function macKeyName(key: string): string {
  const canon = canonKey(key)
  return Object.keys(MAC_KEY).find((name) => name.toLowerCase() === canon) ?? key
}

/** The key a physical `code` names, for when a modifier changed what `key` reports (⌥K is `˚` on a Mac). */
function keyOfCode(code: string | undefined): string | undefined {
  const m = code ? /^(?:Key([A-Z])|Digit(\d))$/.exec(code) : null
  return m ? (m[1] ?? m[2])!.toLowerCase() : undefined
}

function sameMods(want: ReadonlySet<Modifier>, press: KeyPress, ignoreShift: boolean): boolean {
  return want.has("ctrl") === press.ctrlKey && want.has("alt") === press.altKey && want.has("meta") === press.metaKey && (ignoreShift || want.has("shift") === press.shiftKey)
}

/**
 * Does this key press play this chord? Letters match in either case. A symbol typed with Shift
 * (`?`, `+`) matches a chord that names the symbol without `Shift`, since Shift is how the symbol
 * was reached. When a modifier changed the reported key, the physical key (`code`) is tried.
 */
export function matchChord(chord: string | Chord, press: KeyPress, platform: Platform = "other"): boolean {
  const c = typeof chord === "string" ? parseChord(chord, platform) : chord
  const want = canonKey(c.key)
  const got = canonKey(press.key)
  const symbol = want.length === 1 && !/[a-z0-9]/.test(want)
  if (want === got && sameMods(c.mods, press, symbol && !c.mods.has("shift"))) return true
  return want === keyOfCode(press.code) && sameMods(c.mods, press, false)
}

/** One chord bound to one verb, as a {@link Keymap} holds it. */
export interface Binding {
  readonly chord: string
  readonly id: string
}

export interface Keymap {
  readonly bindings: readonly Binding[]
  /** The verb id this key press summons, if any. Hand it to `invoke`, which decides whether it may run. */
  lookup(press: KeyPress): string | undefined
}

function signature(c: Chord): string {
  return [...ORDER.filter((m) => c.mods.has(m)), canonKey(c.key)].join("+")
}

/**
 * The keyboard as a surface: every chord the taste binds (the `keys` attribute, one chord or a
 * list), resolved for a platform and, like a projection, for a context tag. It maps a key press to
 * a verb id and nothing more — availability is `invoke`'s question. Two verbs that apply in the same
 * context and claim the same chord are refused at build, never discovered at a key press.
 */
export function keymap<Ctx, Run>(register: Register<Ctx, Run>, taste: Attributed, options: { readonly platform?: Platform; readonly on?: string } = {}): Keymap {
  const platform = options.platform ?? "other"
  const bindings: Binding[] = []
  const parsed: { readonly chord: Chord; readonly id: string }[] = []
  const bySignature = new Map<string, string>()
  for (const verb of register.verbs) {
    if (verb.on && options.on !== undefined && !verb.on.includes(options.on)) continue
    const keys = taste.attrsOf(verb.id)["keys"]
    const chords = Array.isArray(keys) ? keys.filter((k): k is string => typeof k === "string") : typeof keys === "string" ? [keys] : []
    for (const chord of chords) {
      const c = parseChord(chord, platform)
      const sig = signature(c)
      const holder = bySignature.get(sig)
      if (holder !== undefined && holder !== verb.id) throw new Error(`chord "${chord}" is claimed by both "${holder}" and "${verb.id}"`)
      bySignature.set(sig, verb.id)
      bindings.push({ chord, id: verb.id })
      parsed.push({ chord: c, id: verb.id })
    }
  }
  return {
    bindings,
    lookup: (press) => parsed.find((b) => matchChord(b.chord, press, platform))?.id,
  }
}
