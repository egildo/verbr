import { describe, expect, it } from "vitest"
import { domainOf, kindOf, type Verb } from "./verb.ts"

const v = (extra: Partial<Verb>): Verb => ({ id: "x", run: () => undefined, ...extra })

describe("kindOf — deduced, never declared", () => {
  it("no args, no read → action", () => expect(kindOf(v({}) as never)).toBe("action"))
  it("no args, a read → toggle", () => expect(kindOf(v({ read: () => true }) as never)).toBe("toggle"))
  it("one arg over a named domain → choice", () => expect(kindOf(v({ args: [{ name: "who", domain: "people" }] }) as never)).toBe("choice"))
  it("one arg over inline members → choice", () => expect(kindOf(v({ args: [{ name: "level", domain: [{ value: "1" }] }] }) as never)).toBe("choice"))
  it("one arg to type in → value, readback or not", () => {
    expect(kindOf(v({ args: [{ name: "amount", type: "number" }] }) as never)).toBe("value")
    expect(kindOf(v({ args: [{ name: "href", type: "url" }], read: () => "x" }) as never)).toBe("value")
  })
  it("several args → an action that collects", () => expect(kindOf(v({ args: [{ name: "rows" }, { name: "cols" }] }) as never)).toBe("action"))
})

describe("domainOf", () => {
  it("reads the namespace before the first colon", () => {
    expect(domainOf("document:sign")).toBe("document")
    expect(domainOf("table:row-region:head")).toBe("table")
    expect(domainOf("sell")).toBe("")
  })
})
