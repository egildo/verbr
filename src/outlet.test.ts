import { describe, expect, it } from "vitest"
import { commandName, verbIdOf } from "./outlet.ts"

describe("the outlet — the platform's -- prefix", () => {
  it("spells a verb id as a custom command", () => expect(commandName("document:sign")).toBe("--document:sign"))
  it("reads a verb id back from a command string or an event-shaped object", () => {
    expect(verbIdOf("--document:sign")).toBe("document:sign")
    expect(verbIdOf({ command: "--sell" })).toBe("sell")
  })
  it("answers null for the platform's own commands and for an empty custom one", () => {
    expect(verbIdOf("show-modal")).toBeNull()
    expect(verbIdOf("toggle-popover")).toBeNull()
    expect(verbIdOf("--")).toBeNull()
    expect(verbIdOf("")).toBeNull()
  })
})
