import { describe, expect, it } from "vitest"
import { flat, isGroup, project } from "./project.ts"
import { compose } from "./register.ts"
import { applyTaste } from "./taste.ts"
import type { Verb } from "./verb.ts"

/** A Nodemirror-shaped context: the node's spoken `actions` conclusion, or silence. */
interface Ctx { readonly offered?: readonly string[]; readonly status: string }
const spoken = (id: string) => (ctx: Ctx) => (ctx.offered ? ctx.offered.includes(id) : undefined)

const reg = compose<Ctx, unknown>([
  { id: "sell", run: () => "sell", enabled: spoken("sell"), unavailable: () => "not the seller" },
  { id: "place", run: () => "place", enabled: spoken("place"), args: [{ name: "amount", type: "number" }] },
  { id: "watch", run: () => "watch", enabled: spoken("watch"), read: (c) => c.status === "watched" },
])
const taste = applyTaste(reg, {
  verbs: { sell: { label: "Accept leading bid", icon: "check", section: "closing", keys: ["Mod-Enter"] }, place: { icon: "gavel", section: "bidding" } },
  sections: [{ id: "bidding", label: "Bidding" }, { id: "closing", label: "Closing", as: "menu" }],
})

describe("the three states of enabled", () => {
  it("offered → enabled true; withheld → dropped by default; unspoken → the key is absent", () => {
    const views = flat(project(reg, { offered: ["sell"], status: "open" }, taste))
    expect(views.map((v) => v.id)).toEqual(["sell"])
    expect(views[0]?.enabled).toBe(true)
    const silent = flat(project(reg, { status: "open" }, taste))
    expect(silent.map((v) => v.id)).toEqual(["place", "sell", "watch"])
    for (const v of silent) expect("enabled" in v).toBe(false)
  })
  it("includeUnavailable keeps a withheld verb with its reason; a reason never rides an offered one", () => {
    const views = flat(project(reg, { offered: ["place"], status: "open" }, taste, { includeUnavailable: true }))
    const sell = views.find((v) => v.id === "sell")
    expect(sell).toMatchObject({ enabled: false, reason: "not the seller" })
    expect(views.find((v) => v.id === "place")).not.toHaveProperty("reason")
  })
})

describe("what a view carries", () => {
  it("kind deduced, as defaulted from kind, label from taste or naming, shortcut formatted", () => {
    const [sell] = flat(project(reg, { offered: ["sell"], status: "open" }, taste, { platform: "mac" }))
    expect(sell).toMatchObject({ id: "sell", kind: "action", as: "button", label: "Accept leading bid", icon: "check", shortcut: "⌘↵", keys: ["Mod-Enter"], section: "closing" })
    const [place] = flat(project(reg, { offered: ["place"], status: "open" }, taste))
    expect(place).toMatchObject({ kind: "value", as: "field", label: "Place", args: [{ name: "amount", type: "number" }] })
  })
  it("a toggle reads pressed; pending is the runner's word", () => {
    const [watch] = flat(project(reg, { offered: ["watch"], status: "watched" }, taste, { pending: new Set(["watch"]) }))
    expect(watch).toMatchObject({ kind: "toggle", pressed: true, pending: true })
  })
  it("an icon face drops the faceless; words is the floor", () => {
    expect(flat(project(reg, { status: "open" }, taste, { face: "icon" })).map((v) => v.id)).toEqual(["place", "sell"])
    expect(flat(project(reg, { status: "open" }, taste)).map((v) => v.id)).toContain("watch")
  })
})

describe("applicability — `on` is where a verb lives, not whether it may run", () => {
  it("a tagged verb appears only under its tags; an untagged one appears everywhere; no option projects all", () => {
    const r = compose<Ctx, unknown>([
      { id: "split", run: () => "split", on: ["item"] },
      { id: "sell", run: () => "sell" },
    ])
    const t = applyTaste(r, {})
    const ids = (on?: string) => flat(project(r, { status: "open" }, t, on ? { on } : {})).map((v) => v.id)
    expect(ids("item")).toEqual(["split", "sell"])
    expect(ids("bid")).toEqual(["sell"])
    expect(ids()).toEqual(["split", "sell"])
  })
})

describe("the tree", () => {
  it("lays views into sections, carries a section's taste, drops an empty group", () => {
    const tree = project(reg, { offered: ["sell"], status: "open" }, taste)
    expect(tree.map((i) => (isGroup(i) ? `group:${i.id}` : `view:${i.id}`))).toEqual(["group:closing"])
    const closing = tree[0]
    expect(closing && isGroup(closing) && closing["as"]).toBe("menu")
  })
})

describe("prediction nine — the projection is already a manifest", () => {
  it("round-trips through JSON with nothing lost", () => {
    const tree = project(reg, { offered: ["sell", "place"], status: "watched" }, taste, { includeUnavailable: true })
    expect(JSON.parse(JSON.stringify(tree))).toEqual(tree)
    const walk = (x: unknown): void => {
      expect(typeof x).not.toBe("function")
      if (x && typeof x === "object") Object.values(x).forEach(walk)
    }
    walk(tree)
  })
})
