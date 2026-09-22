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
    expect(() => applyTaste(reg, { layers: [{ name: "evil", attrs: { on: ["item"] } }] })).toThrow(/capability key "on"/)
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

describe("refusals — a selection that could never match", () => {
  it("refuses selecting on a capability or projected key, and an unknown kind", () => {
    expect(() => applyTaste(reg, { layers: [{ name: "w", where: { on: "item" }, attrs: { x: 1 } }] })).toThrow(/selects on "on"/)
    expect(() => applyTaste(reg, { layers: [{ name: "w", where: { enabled: null }, attrs: { x: 1 } }] })).toThrow(/selects on "enabled"/)
    expect(() => applyTaste(reg, { layers: [{ name: "w", where: { pressed: true }, attrs: { x: 1 } }] })).toThrow(/selects on "pressed"/)
    expect(() => applyTaste(reg, { layers: [{ name: "w", where: { kind: "button" as never }, attrs: { x: 1 } }] })).toThrow(/unknown kind "button"/)
    expect(() => applyTaste(reg, { layers: [{ name: "w", where: { id: 3 as never }, attrs: { x: 1 } }] })).toThrow(/id that is not a string/)
  })
  it("refuses a taste key that misspells a capability", () => {
    expect(() => applyTaste(reg, { verbs: { strong: { enable: false } } })).toThrow(/did you mean the capability key "enabled"/)
  })
  it("refuses a control-shaped key reserved for groups", () => {
    expect(() => applyTaste(reg, { verbs: { strong: { items: [] } } })).toThrow(/projected key "items"/)
    expect(() => applyTaste(compose({ id: "m", run: () => 0, items: ["x"] }), {})).toThrow(/declares projected key "items"/)
  })
})

describe("derivations", () => {
  it("refuses a name only the object prototype holds", () => {
    for (const name of ["toString", "constructor", "hasOwnProperty", "__proto__"]) {
      expect(() => applyTaste(reg, { layers: [{ name: "d", attrs: { title: { derive: name } } }] }), name).toThrow(/unknown derivation/)
    }
  })
  it("resolves a derivation the declaration carries, and refuses an unknown one there too", () => {
    const r = compose({ id: "doc:sign-it", run: () => 0, label: { derive: "humanize" } })
    expect(applyTaste(r, {}).attrsOf("doc:sign-it")["label"]).toBe("Sign it")
    expect(() => applyTaste(compose({ id: "x", run: () => 0, title: { derive: "shout" } }), {})).toThrow(/verb "x" names unknown derivation "shout"/)
  })
  it("a label stated as null is absent, so the naming default fills it", () => {
    const r = compose({ id: "doc:sign-it", run: () => 0, label: null })
    expect(applyTaste(r, {}).attrsOf("doc:sign-it")["label"]).toBe("Sign it")
  })
})

describe("sections — a closed vocabulary", () => {
  it("refuses a verb placed in an undeclared section", () => {
    expect(() => applyTaste(reg, { verbs: { strong: { section: "typo" } } })).toThrow(/section "typo", which no taste document declares/)
    expect(() => applyTaste(compose({ id: "x", run: () => 0, section: "nowhere" }), {})).toThrow(/section "nowhere"/)
  })
  it("refuses an undeclared parent and a loop of parents", () => {
    expect(() => applyTaste(reg, { sections: [{ id: "s", parent: "nope" }] })).toThrow(/undeclared parent "nope"/)
    expect(() => applyTaste(reg, { sections: [{ id: "a", parent: "b" }, { id: "b", parent: "a" }] })).toThrow(/loop of parents/)
    expect(() => applyTaste(reg, { sections: [{ id: "a", parent: "a" }] })).toThrow(/loop of parents/)
  })
  it("a section declared in one document may be used from another", () => {
    const t = applyTaste(reg, [{ sections: [{ id: "marks" }] }, { verbs: { strong: { section: "marks" } } }])
    expect(t.attrsOf("strong")["section"]).toBe("marks")
  })
})

describe("orphans — taste that reached nothing is seen, not refused", () => {
  it("names a verbs entry for an id the register lacks and a layer that selected nothing", () => {
    const t = applyTaste(reg, { name: "house", verbs: { sel: { label: "X" }, strong: { label: "Bold" } }, layers: [{ name: "gone", where: { id: "nope:*" }, attrs: { x: 1 } }, { name: "hit", where: { id: "table:*" }, attrs: { y: 1 } }] })
    expect(t.orphans()).toEqual([{ layer: "house:verbs", id: "sel" }, { layer: "house:gone" }])
  })
  it("is empty when everything landed, the naming layer included", () => {
    expect(applyTaste(reg, { verbs: { strong: { label: "Bold" } } }).orphans()).toEqual([])
  })
})
