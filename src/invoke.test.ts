import { describe, expect, it } from "vitest"
import { invoke, prepare } from "./invoke.ts"
import { compose } from "./register.ts"
import { applyTaste } from "./taste.ts"

interface Ctx { readonly done: number; readonly signedIn?: boolean }
const reg = compose<Ctx, string>([
  { id: "todo:add", run: (_c, a) => `add ${String(a?.["title"])}`, args: [{ name: "title", type: "text", required: true }] },
  { id: "todo:clear-done", run: () => "clear", appliesTo: (c) => ({ n: c.done, of: 3 }), unavailable: () => "nothingDone" },
  { id: "todo:sync", run: () => "sync", enabled: (c) => c.signedIn },
  { id: "table:split", run: () => "split", on: ["table"] },
])

describe("prepare — everything short of running", () => {
  it("clears a verb that may run, without running it", () => {
    const p = prepare(reg, "todo:add", { done: 0 }, { title: "Milk" })
    expect(p).toMatchObject({ ok: true, id: "todo:add", args: { title: "Milk" } })
  })
  it("refuses with a code an agent can read", () => {
    expect(prepare(reg, "todo:nope", { done: 0 })).toEqual({ ok: false, id: "todo:nope", code: "unknown" })
    expect(prepare(reg, "table:split", { done: 0 }, undefined, { on: "list" })).toEqual({ ok: false, id: "table:split", code: "inapplicable" })
    expect(prepare(reg, "todo:clear-done", { done: 0 })).toEqual({ ok: false, id: "todo:clear-done", code: "withheld", cause: "nothingDone", reason: "Nothing done" })
    expect(prepare(reg, "todo:sync", { done: 0, signedIn: false })).toEqual({ ok: false, id: "todo:sync", code: "withheld" })
    expect(prepare(reg, "todo:add", { done: 0 }, {})).toEqual({ ok: false, id: "todo:add", code: "args", issues: [{ arg: "title", problem: "missing" }] })
  })
  it("taste words a refusal, and never decides it", () => {
    const taste = applyTaste(reg, { reasons: { nothingDone: "Nothing is done yet" } })
    expect(prepare(reg, "todo:clear-done", { done: 0 }, undefined, { taste })).toEqual({ ok: false, id: "todo:clear-done", code: "withheld", cause: "nothingDone", reason: "Nothing is done yet" })
    for (const id of reg.ids()) for (const done of [0, 2]) expect(prepare(reg, id, { done }).ok).toBe(prepare(reg, id, { done }, undefined, { taste }).ok)
    expect(() => prepare(reg, "todo:sync", { done: 0 }, undefined, { taste: applyTaste(compose([{ id: "other", run: () => "" }]), {}) })).toThrow(/no resolved taste/)
  })
  it("a guard's cause reaches the refusal", () => {
    const r = compose<Ctx, string>([{ id: "todo:sync", run: () => "sync", enabled: { rule: "signedIn" } }], { rules: { signedIn: (c: Ctx) => c.signedIn } })
    expect(prepare(r, "todo:sync", { done: 0, signedIn: false })).toEqual({ ok: false, id: "todo:sync", code: "withheld", cause: "signedIn", reason: "Signed in" })
  })
  it("lets an unspoken verb through unless asked not to", () => {
    expect(prepare(reg, "todo:sync", { done: 0 }).ok).toBe(true)
    expect(prepare(reg, "todo:sync", { done: 0 }, undefined, { refuseUnspoken: true })).toEqual({ ok: false, id: "todo:sync", code: "unspoken" })
  })
})

describe("invoke — prepare, then run", () => {
  it("hands back what run returned, untouched", () => {
    expect(invoke(reg, "todo:add", { done: 0 }, { title: "Milk" })).toEqual({ ok: true, id: "todo:add", value: "add Milk" })
    expect(invoke(reg, "todo:clear-done", { done: 2 })).toEqual({ ok: true, id: "todo:clear-done", value: "clear" })
  })
  it("never runs a refused verb", () => {
    let ran = false
    const r = compose<Ctx, undefined>([{ id: "x", run: () => { ran = true; return undefined }, enabled: () => false }])
    expect(invoke(r, "x", { done: 0 }).ok).toBe(false)
    expect(ran).toBe(false)
  })
})
