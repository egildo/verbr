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

describe("compose — refusals for what no surface could use", () => {
  it("refuses an empty or non-string id", () => {
    expect(() => compose(verb(""))).toThrow(/non-empty string/)
    expect(() => compose({ id: 1, run: () => 0 } as unknown as Verb)).toThrow(/non-empty string/)
  })
  it("refuses an `on` that is not a list of tags", () => {
    expect(() => compose({ ...verb("a"), on: "item" } as unknown as Verb)).toThrow(/not a list of tags/)
  })
  it("refuses a key that misspells a capability, and keeps honest extras", () => {
    expect(() => compose({ ...verb("a"), enable: () => true } as Verb)).toThrow(/did you mean the capability key "enabled"/)
    expect(() => compose({ ...verb("a"), unavailble: () => "no" } as Verb)).toThrow(/"unavailable"/)
    expect(() => compose({ ...verb("a"), Run: 1 } as Verb)).toThrow(/"run"/)
    expect(compose({ ...verb("a"), danger: true, one: 1, ready: true } as Verb).has("a")).toBe(true)
  })
})

describe("typed args", () => {
  it("a verb typed with its own Args composes", () => {
    interface Bid { readonly amount: number }
    const place: Verb<unknown, string, Bid> = { id: "place", run: (_c, a) => String(a?.amount) }
    expect(compose<unknown, string>(place).get("place")?.run(undefined, { amount: 3 })).toBe("3")
  })
})
