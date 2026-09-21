import { describe, expect, it } from "vitest"
import { compose } from "./register.ts"
import { applyTaste, humanize, type Taste } from "./taste.ts"
import type { Verb } from "./verb.ts"

const verb = (id: string, extra: Partial<Verb> = {}): Verb => ({ id, run: () => id, ...extra })
const reg = compose([
  verb("table:add-row-after"),
  verb("strong", { read: () => true }),
  verb("blocktype", { args: [{ name: "type", domain: [{ value: "paragraph" }, { value: "heading" }] }] }),
  verb("table:caption", { args: [{ name: "text", type: "text" }] }),
  verb("table:column-width", { args: [{ name: "px", type: "number" }], read: () => 120 }),
])

describe("the naming default", () => {
  it("humanizes an id, dropping the namespace", () => {
    expect(humanize("table:add-row-after")).toBe("Add row after")
    expect(humanize("strong")).toBe("Strong")
  })
  it("is a layer, seated first, visible in describe, overridable by anything", () => {
    const t = applyTaste(reg, { verbs: { strong: { label: "Bold" } } })
    expect(t.attrsOf("table:add-row-after")["label"]).toBe("Add row after")
    expect(t.attrsOf("strong")["label"]).toBe("Bold")
    expect(t.describe("strong", "label").map((c) => [c.layer, c.wins])).toEqual([["naming", false], ["taste:verbs", true]])
  })
})

describe("layers — order is the only precedence", () => {
  it("later wins per key; a layer sees the register as resolved so far", () => {
    const t = applyTaste(reg, {
      layers: [
        { name: "room", where: { kind: "value", argType: "text" }, attrs: { room: "unbounded" } },
        { name: "dock", where: { room: "unbounded" }, attrs: { manner: "docked" } },
        { name: "menu", where: { id: "table:*" }, attrs: { manner: "menu" } },
      ],
    })
    expect(t.attrsOf("table:caption")["room"]).toBe("unbounded")
    // the glob layer came later and beat the derived one — order, not specificity
    expect(t.attrsOf("table:caption")["manner"]).toBe("menu")
    expect(t.attrsOf("table:column-width")["manner"]).toBe("menu")
    expect(t.attrsOf("strong")["manner"]).toBeUndefined()
  })
  it("null in where matches an absent attribute", () => {
    const t = applyTaste(reg, { verbs: { strong: { icon: "bold" } }, layers: [{ name: "faceless", where: { icon: null }, attrs: { manner: "none" } }] })
    expect(t.attrsOf("strong")["manner"]).toBeUndefined()
    expect(t.attrsOf("blocktype")["manner"]).toBe("none")
  })
  it("several documents stack root-first, the same shape at every depth", () => {
    const house: Taste = { name: "house", verbs: { strong: { label: "Bold", icon: "bold" } } }
    const italian: Taste = { name: "it", verbs: { strong: { label: "Grassetto" } } }
    const t = applyTaste(reg, [house, italian])
    expect(t.attrsOf("strong")).toMatchObject({ label: "Grassetto", icon: "bold" })
    expect(t.describe("strong", "label").filter((c) => c.wins).map((c) => c.layer)).toEqual(["it:verbs"])
  })
  it("the declaration's own taste is the floor", () => {
    const r = compose({ ...verb("x"), icon: "declared-icon" } as Verb)
    const t = applyTaste(r, { verbs: { x: { icon: "host-icon" } } })
    expect(t.attrsOf("x")["icon"]).toBe("host-icon")
    expect(t.describe("x", "icon").map((c) => c.layer)).toEqual(["declared", "taste:verbs"])
  })
})

describe("refusals — loud, at build", () => {
  it("a layer may not reach a capability key", () => {
    expect(() => applyTaste(reg, { layers: [{ name: "evil", attrs: { enabled: true } }] })).toThrow(/capability key "enabled"/)
    expect(() => applyTaste(reg, { verbs: { strong: { run: 1 } } })).toThrow(/capability key "run"/)
  })
  it("neither a layer nor a declaration may state what the projection reads", () => {
    expect(() => applyTaste(reg, { verbs: { strong: { pressed: true } } })).toThrow(/projected key "pressed"/)
    expect(() => applyTaste(reg, { layers: [{ name: "evil", attrs: { reason: "lies" } }] })).toThrow(/projected key "reason"/)
    expect(() => applyTaste(compose({ id: "x", run: () => 0, pending: true }), {})).toThrow(/declares projected key "pending"/)
  })
  it("an unknown derivation is refused, a known one resolves", () => {
    expect(() => applyTaste(reg, { layers: [{ name: "d", attrs: { label: { derive: "shout" } } }] })).toThrow(/unknown derivation "shout"/)
    const t = applyTaste(reg, { layers: [{ name: "d", attrs: { title: { derive: "shout" } } }] }, { shout: (v) => v.id.toUpperCase() })
    expect(t.attrsOf("strong")["title"]).toBe("STRONG")
  })
})

describe("sight", () => {
  it("audit reports every contested pair and refuses nothing", () => {
    const t = applyTaste(reg, { verbs: { strong: { label: "Bold" } } })
    expect(t.audit()).toEqual([{ id: "strong", key: "label", claims: expect.any(Array) }])
  })
  it("sections merge by id across documents, later winning per key", () => {
    const t = applyTaste(reg, [{ sections: [{ id: "closing", label: "Closing" }] }, { sections: [{ id: "closing", as: "menu" }] }])
    expect(t.sections).toEqual([{ id: "closing", label: "Closing", as: "menu" }])
  })
})
