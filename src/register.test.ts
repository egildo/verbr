import { describe, expect, it } from "vitest"
import { compose } from "./register.ts"
import type { Verb } from "./verb.ts"

const verb = (id: string): Verb => ({ id, run: () => id })

describe("compose — one act, one gate", () => {
  it("composes sets and single entries in order", () => {
    const r = compose([verb("a"), verb("b")], verb("c"))
    expect(r.ids()).toEqual(["a", "b", "c"])
    expect(r.get("b")?.id).toBe("b")
    expect(r.has("z")).toBe(false)
  })
  it("refuses a duplicate id at build, not at a click", () => {
    expect(() => compose([verb("a")], [verb("a")])).toThrow(/claimed twice: a/)
  })
  it("preserves extra properties — the NodeSpec allowance", () => {
    const r = compose({ ...verb("t"), tableRole: "cell" } as Verb)
    expect(r.get("t")?.["tableRole"]).toBe("cell")
  })
})
