// The experiment's headless predictions, filed in the plan before this file existed.
import { describe, expect, it } from "vitest"
import { flat, project, type VerbView } from "./project.ts"
import { compose } from "./register.ts"
import { applyTaste, type Taste } from "./taste.ts"
import { kindOf, type Verb } from "./verb.ts"

describe("prediction one — the union needs no new word", () => {
  // Every field of the three registers, and where it lands here. A field with no home breaks the prediction.
  const homes: Record<string, string> = {
    // @sibar/verbs — Verb
    "sibar.Verb.id": "Verb.id", "sibar.Verb.affects": "Verb[extra] (a REST host's extension)", "sibar.Verb.enabled": "Verb.enabled (now boolean | undefined)",
    "sibar.Verb.unavailable": "Verb.unavailable", "sibar.Verb.read": "Verb.read", "sibar.Verb.appliesTo": "Verb.appliesTo", "sibar.Verb.args": "Verb.args",
    "sibar.Verb.run": "Verb.run", "sibar.Verb.danger": "Verb[extra] → VerbView[attr]", "sibar.Verb.heavy": "Verb[extra] → VerbView[attr]",
    "sibar.Verb.placeholder": "Verb[extra] → VerbView[attr]", "sibar.Verb.collector": "Verb[extra] → VerbView[attr]",
    // @sibar/verbs — VerbArg
    "sibar.VerbArg.id": "VerbArg.name (rename)", "sibar.VerbArg.label": "VerbArg[extra] (taste)", "sibar.VerbArg.domain": "VerbArg.domain as a name",
    "sibar.VerbArg.required": "VerbArg.required", "sibar.VerbArg.input": "VerbArg.type (rename)",
    // @sibar/model — VerbView
    "sibar.VerbView.id": "VerbView.id", "sibar.VerbView.label": "VerbView.label", "sibar.VerbView.icon": "VerbView.icon", "sibar.VerbView.kind": "VerbView.kind",
    "sibar.VerbView.enabled": "VerbView.enabled (absent when unspoken)", "sibar.VerbView.pending": "VerbView.pending", "sibar.VerbView.pressed": "VerbView.pressed",
    "sibar.VerbView.reason": "VerbView.reason", "sibar.VerbView.description": "VerbView[attr] (taste)", "sibar.VerbView.appliesTo": "VerbView.appliesTo",
    "sibar.VerbView.danger": "VerbView[attr]", "sibar.VerbView.heavy": "VerbView[attr]", "sibar.VerbView.shortcut": "VerbView.shortcut", "sibar.VerbView.placeholder": "VerbView[attr]",
    "sibar.VerbView.args": "VerbView.args", "sibar.VerbView.collector": "VerbView[attr]", "sibar.VerbGroupView": "Group",
    // @sibar/verbs — Effect: not a register concern; the host's `Run` type carries what `run` returns
    "sibar.Effect": "Run (the host's own type parameter)",
    // prosemirror-verbs — Capability / VerbEntry / Verb
    "pm.Capability.id": "Verb.id", "pm.Capability.command": "Verb.run (normalized: args are run's second parameter)", "pm.Capability.read": "Verb.read",
    "pm.Capability.enabled": "Verb.enabled", "pm.Capability.args": "Verb.args", "pm.Verb.run": "Verb.run",
    "pm.VerbEntry.label": "Taste.verbs[id].label or declared floor", "pm.VerbEntry.icon": "Taste.verbs[id].icon", "pm.VerbEntry.as": "Taste.verbs[id].as",
    "pm.VerbEntry.keys": "Taste.verbs[id].keys", "pm.VerbEntry.keywords": "Taste.verbs[id].keywords (open bag)", "pm.VerbEntry.group": "Taste.verbs[id].section (rename)",
    "pm.VerbArg.name": "VerbArg.name", "pm.VerbArg.type": "VerbArg.type", "pm.VerbArg.domain": "VerbArg.domain as inline members", "pm.DomainMember.value": "DomainMember.value",
    "pm.DomainMember.label/icon/keys": "DomainMember[extra] (taste)",
    // prosemirror-verbs — AttrLayer / Attributed
    "pm.AttrLayer.name": "Layer.name", "pm.AttrLayer.match": "Layer.where (data, not a predicate)", "pm.AttrLayer.attrs": "Layer.attrs (literal or named Derivation)",
    "pm.Attributed.describe": "Attributed.describe", "pm.Attributed.audit": "Attributed.audit", "pm.namingLayer": "NAMING",
    // prosemirror-verbs — ControlSpec / tree
    "pm.ControlSpec.kind": "VerbView.kind", "pm.ControlSpec.as": "VerbView.as", "pm.ControlSpec.label": "VerbView.label", "pm.ControlSpec.title": "VerbView[attr] (taste)",
    "pm.ControlSpec.icon": "VerbView.icon", "pm.ControlSpec.command": "not projected: a VerbView holds no function; the host runs by id", "pm.ControlSpec.active": "VerbView.pressed",
    "pm.ControlSpec.value": "VerbView.value", "pm.ControlSpec.write": "not projected: the host runs by id with args", "pm.ControlSpec.options": "VerbView.args[0].domain",
    "pm.ControlSpec.type": "VerbView.args[0].type", "pm.ControlSpec.keys": "VerbView.shortcut (formatted) + VerbView[attr] keys", "pm.ControlSpec.group": "VerbView.section",
    "pm.GroupSpec": "Section", "pm.ControlGroup": "Group", "pm.FaceRule": "Face",
    // Nodemirror — the action catalogue and the label map
    "nm.ActionSchema.type": "Verb.id", "nm.ActionSchema.maxSelection": "Verb[extra] (the host's arity)", "nm.ActionSchema.payload": "Verb.args (one per payload field, type from the cell)",
    "nm.actions conclusion": "Verb.enabled reading the spoken list; undefined when unspoken", "nm.defineActions.labels": "Taste.verbs[id].label",
  }
  it("every field of the three registers has a home", () => {
    for (const [source, home] of Object.entries(homes)) expect(home, source).not.toMatch(/^\?/)
    expect(Object.keys(homes).length).toBeGreaterThan(60)
  })
  it("a verb carrying every sibardoc field and every prosemirror-verbs field composes and projects", () => {
    const everything: Verb = {
      id: "document:sign", run: () => "cmd", enabled: () => true, unavailable: () => undefined, read: () => false, appliesTo: () => 3,
      args: [{ name: "reason", type: "text", required: true, label: "Motivazione" }],
      affects: [{ type: "documents" }], danger: true, heavy: false, placeholder: true, collector: "sign-deck",
      label: "Firma", icon: "approval", as: "button", keys: ["Mod-Shift-f"], keywords: ["firmare"], group: "approval", description: "Appone la firma.",
    }
    const [v] = flat(project(compose(everything), undefined, applyTaste(compose(everything), {}), { of: 7, platform: "mac" })) as [VerbView]
    expect(v).toMatchObject({ id: "document:sign", kind: "value", label: "Firma", icon: "approval", enabled: true, appliesTo: { n: 3, of: 7 }, shortcut: "⌘⇧F", danger: true, placeholder: true, collector: "sign-deck", keywords: ["firmare"] })
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
