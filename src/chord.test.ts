import { describe, expect, it } from "vitest"
import { formatChord } from "./chord.ts"

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
  it("treats the last part as the key, even when it spells a modifier's letter", () => {
    expect(formatChord("Mod-s", "mac")).toBe("⌘S")
    expect(formatChord("Shift")).toBe("Shift")
    expect(formatChord("Shift", "mac")).toBe("⇧")
  })
})
