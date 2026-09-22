// The experiment's headless predictions, filed in the plan before this file existed. Where each
// ancestor's field landed is tabled in DESIGN.md; this file keeps the claims that can be run.
import { describe, expect, it } from "vitest"
import { flat, project, type Control } from "./project.ts"
import { compose } from "./register.ts"
import { applyTaste, type Taste } from "./taste.ts"
import { kindOf, type Verb } from "./verb.ts"

describe("prediction one — the union needs no new word", () => {
  it("a verb carrying every sibardoc field and every prosemirror-verbs field composes and projects", () => {
    const everything: Verb = {
      id: "document:sign", run: () => "cmd", enabled: () => true, unavailable: () => undefined, read: () => false, appliesTo: () => 3,
      args: [{ name: "reason", type: "text", required: true, label: "Motivazione" }],
      affects: [{ type: "documents" }], danger: true, heavy: false, placeholder: true, collector: "sign-deck",
      label: "Firma", icon: "approval", as: "button", keys: ["Mod-Shift-f"], keywords: ["firmare"], group: "approval", description: "Appone la firma.",
    }
    const [v] = flat(project(compose(everything), undefined, applyTaste(compose(everything), {}), { of: 7, platform: "mac" })) as [Control]
    expect(v).toMatchObject({ id: "document:sign", kind: "value", label: "Firma", icon: "approval", enabled: true, appliesTo: { n: 3, of: 7 }, shortcut: "⇧⌘F", danger: true, placeholder: true, collector: "sign-deck", keywords: ["firmare"] })
  })
})

describe("prediction two — the venue's five layers rewrite as data with zero loss", () => {
  // Reconstructed from the prosemirror-verbs tablet (V13's pinned test), the venue itself being out of reach:
  //   room from the declaration's shape · manner off room · curation by manner: 'none' · hide what dry-runs unavailable · the naming default.
  const V = (id: string, extra: Partial<Verb> = {}): Verb => ({ id, run: () => id, ...extra })
  const reg = compose([
    V("strong", { read: () => true }),
    V("blocktype", { args: [{ name: "type", domain: [{ value: "paragraph" }, { value: "heading" }] }] }),
    V("table:column-width", { args: [{ name: "px", type: "number" }], read: () => 100 }),
    V("table:caption", { args: [{ name: "text", type: "text" }], read: () => "" }),
    V("table:formula", { args: [{ name: "expr", type: "text" }], read: () => "" }),
    V("insert:table_cell"),
    V("table:add-row-after", { enabled: () => false }),
  ])
  const venue: Taste = {
    name: "venue",
    verbs: { strong: { icon: "bold" }, blocktype: { icon: "paragraph" }, "table:column-width": { icon: "width" }, "table:caption": { icon: "caption" }, "table:formula": { icon: "fx" }, "table:add-row-after": { icon: "row-after" } },
    layers: [
      // 1 · room, derived from the declaration's own shape
      { name: "room-glyph", where: { kind: "action" }, attrs: { room: "glyph" } },
      { name: "room-glyph-toggle", where: { kind: "toggle" }, attrs: { room: "glyph" } },
      { name: "room-bounded-choice", where: { kind: "choice" }, attrs: { room: "bounded" } },
      { name: "room-bounded-number", where: { kind: "value", argType: "number" }, attrs: { room: "bounded" } },
      { name: "room-unbounded", where: { kind: "value", argType: "text" }, attrs: { room: "unbounded" } },
      // 2 · manner, matched off room
      { name: "dock-unbounded", where: { room: "unbounded" }, attrs: { manner: "docked" } },
      // 3 · curation, said as data rather than as .filter() calls
      { name: "curate", where: { id: "insert:*" }, attrs: { manner: "none" } },
    ],
  }
  const taste = applyTaste(reg, venue)
  it("room derives from shape", () => {
    expect(taste.attrsOf("strong")["room"]).toBe("glyph")
    expect(taste.attrsOf("blocktype")["room"]).toBe("bounded")
    expect(taste.attrsOf("table:column-width")["room"]).toBe("bounded")
    expect(taste.attrsOf("table:caption")["room"]).toBe("unbounded")
  })
  it("manner matches off room — a layer sees the register as resolved so far", () => {
    expect(taste.attrsOf("table:caption")["manner"]).toBe("docked")
    expect(taste.attrsOf("table:formula")["manner"]).toBe("docked")
    expect(taste.attrsOf("strong")["manner"]).toBeUndefined()
  })
  it("curation is a layer; hiding the unavailable is the projection's option, not taste (a finding)", () => {
    expect(taste.attrsOf("insert:table_cell")["manner"]).toBe("none")
    const shown = flat(project(reg, undefined, taste, { face: "icon" })).map((v) => v.id)
    expect(shown).not.toContain("table:add-row-after") // dry-runs unavailable → hidden
    expect(shown).not.toContain("insert:table_cell") // no icon → no control on a strip
    expect(shown).toContain("table:caption")
  })
  it("describe names the layer that won", () => {
    expect(taste.describe("table:caption", "manner").filter((c) => c.wins).map((c) => c.layer)).toEqual(["venue:dock-unbounded"])
  })
})

describe("prediction three — the label map is one taste document", () => {
  const labels = { place: "Place bid", sell: "Accept leading bid" } // defineActions' `labels`, verbatim
  const asTaste: Taste = { verbs: Object.fromEntries(Object.entries(labels).map(([id, label]) => [id, { label }])) }
  const reg = compose([{ id: "place", run: () => 0, args: [{ name: "amount", type: "number" }] }, { id: "sell", run: () => 0 }, { id: "watch", run: () => 0 }])
  it("labels come through unchanged; an unlabelled action falls to the naming default, as the map fell to the type", () => {
    const byId = Object.fromEntries(flat(project(reg, undefined, applyTaste(reg, asTaste))).map((v) => [v.id, v.label]))
    expect(byId).toEqual({ place: "Place bid", sell: "Accept leading bid", watch: "Watch" })
  })
  it("kinds fall out of the payload spec nobody had to restate", () => {
    expect(kindOf(reg.get("place") as never)).toBe("value")
    expect(kindOf(reg.get("sell") as never)).toBe("action")
  })
})
