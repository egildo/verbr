import { describe, expect, it } from "vitest"
import { formatChord, keymap, matchChord } from "./chord.ts"
import { compose } from "./register.ts"
import { applyTaste } from "./taste.ts"

describe("formatChord", () => {
  it("draws glyphs on a Mac and words elsewhere", () => {
    expect(formatChord("Mod-Enter", "mac")).toBe("⌘↵")
    expect(formatChord("Mod-Enter")).toBe("Ctrl+Enter")
    expect(formatChord("Meta-k")).toBe("Win+K")
  })
  it("keeps a trailing - or + as the key itself", () => {
    expect(formatChord("Mod--", "mac")).toBe("⌘-")
    expect(formatChord("Mod--")).toBe("Ctrl+-")
    expect(formatChord("Ctrl++")).toBe("Ctrl++")
    expect(formatChord("-")).toBe("-")
  })
  it("orders modifiers the platform's way, whatever order they were written in", () => {
    expect(formatChord("Mod-Shift-z", "mac")).toBe("⇧⌘Z")
    expect(formatChord("Shift-Alt-Ctrl-x", "mac")).toBe("⌃⌥⇧X")
    expect(formatChord("Shift-Mod-z")).toBe("Ctrl+Shift+Z")
  })
  it("reads every modifier spelling, in any case, and + as a separator", () => {
    expect(formatChord("Control-x", "mac")).toBe("⌃X")
    expect(formatChord("ctrl+shift+k")).toBe("Ctrl+Shift+K")
    expect(formatChord("Option-Cmd-i", "mac")).toBe("⌥⌘I")
    expect(formatChord("c-a-s-Delete", "mac")).toBe("⌃⌥⇧⌦")
  })
  it("reads Electron's accelerator spelling", () => {
    expect(formatChord("CommandOrControl+Shift+C", "mac")).toBe("⇧⌘C")
    expect(formatChord("CmdOrCtrl+R")).toBe("Ctrl+R")
    expect(formatChord("commandorcontrol+,", "mac")).toBe("⌘,")
  })
  it("refuses a part that is neither a modifier nor the key", () => {
    expect(() => formatChord("Hyper+T", "mac")).toThrow(/chord "Hyper\+T" has unknown modifier "Hyper"/)
    expect(() => matchChord("Cmmand-t", press("t", { meta: true }), "mac")).toThrow(/unknown modifier "Cmmand"/)
  })
  it("draws a key alias as the key it names", () => {
    expect(formatChord("CommandOrControl+Left", "mac")).toBe("⌘←")
    expect(formatChord("Up", "mac")).toBe("↑")
    expect(formatChord("Shift-Esc", "mac")).toBe("⇧⎋")
    expect(formatChord("Mod-Return", "mac")).toBe("⌘↵")
    expect(formatChord("Del", "mac")).toBe("⌦")
  })
  it("treats the last part as the key, even when it spells a modifier's letter", () => {
    expect(formatChord("Mod-s", "mac")).toBe("⌘S")
    expect(formatChord("Shift")).toBe("Shift")
    expect(formatChord("Shift", "mac")).toBe("⇧")
  })
})

const press = (key: string, mods: Partial<{ ctrl: boolean; alt: boolean; shift: boolean; meta: boolean }> = {}, code?: string) =>
  ({ key, ...(code ? { code } : {}), ctrlKey: !!mods.ctrl, altKey: !!mods.alt, shiftKey: !!mods.shift, metaKey: !!mods.meta })

describe("matchChord", () => {
  it("resolves Mod per platform", () => {
    expect(matchChord("Mod-k", press("k", { meta: true }), "mac")).toBe(true)
    expect(matchChord("Mod-k", press("k", { ctrl: true }), "mac")).toBe(false)
    expect(matchChord("Mod-k", press("k", { ctrl: true }))).toBe(true)
  })
  it("matches letters in either case, and demands exactly the modifiers named", () => {
    expect(matchChord("Mod-Shift-z", press("Z", { ctrl: true, shift: true }))).toBe(true)
    expect(matchChord("Mod-z", press("Z", { ctrl: true, shift: true }))).toBe(false)
    expect(matchChord("Mod-z", press("z", { ctrl: true, alt: true }))).toBe(false)
  })
  it("lets Shift reach a symbol, and reads key aliases", () => {
    expect(matchChord("Mod-?", press("?", { ctrl: true, shift: true }))).toBe(true)
    expect(matchChord("Ctrl++", press("+", { ctrl: true, shift: true }))).toBe(true)
    expect(matchChord("Space", press(" "))).toBe(true)
    expect(matchChord("Esc", press("Escape"))).toBe(true)
  })
  it("falls back to the physical key when a modifier changed what key reports", () => {
    expect(matchChord("Alt-k", press("˚", { alt: true }, "KeyK"), "mac")).toBe(true)
    expect(matchChord("Alt-k", press("˚", { alt: true }), "mac")).toBe(false)
  })
})

describe("keymap — the keyboard as a surface", () => {
  const reg = compose([
    { id: "todo:add", run: () => 0 },
    { id: "todo:undo", run: () => 0 },
    { id: "table:split", run: () => 0, on: ["table"] },
    { id: "list:split", run: () => 0, on: ["list"] },
  ])
  const taste = applyTaste(reg, { verbs: { "todo:add": { keys: ["Mod-Enter", "Mod-n"] }, "todo:undo": { keys: "Mod-z" }, "table:split": { keys: ["Mod-s"] }, "list:split": { keys: ["Mod-s"] } } })
  it("maps a key press to a verb id, for the context asked", () => {
    const km = keymap(reg, taste, { platform: "mac", on: "table" })
    expect(km.lookup(press("n", { meta: true }))).toBe("todo:add")
    expect(km.lookup(press("z", { meta: true }))).toBe("todo:undo")
    expect(km.lookup(press("s", { meta: true }))).toBe("table:split")
    expect(km.lookup(press("q", { meta: true }))).toBeUndefined()
    expect(km.bindings.map((b) => b.id)).toEqual(["todo:add", "todo:add", "todo:undo", "table:split"])
  })
  it("refuses two verbs claiming one chord where both apply", () => {
    expect(() => keymap(reg, taste)).toThrow(/"Mod-s" is claimed by both "table:split" and "list:split"/)
  })
})
