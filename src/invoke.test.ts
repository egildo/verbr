import { describe, expect, it } from "vitest"
import { invoke, prepare } from "./invoke.ts"
import { compose } from "./register.ts"

interface Ctx { readonly done: number; readonly signedIn?: boolean }
const reg = compose<Ctx, string>([
  { id: "todo:add", run: (_c, a) => `add ${String(a?.["title"])}`, args: [{ name: "title", type: "text", required: true }] },
  { id: "todo:clear-done", run: () => "clear", appliesTo: (c) => c.done, unavailable: () => "nothing is done" },
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
    expect(prepare(reg, "todo:clear-done", { done: 0 })).toEqual({ ok: false, id: "todo:clear-done", code: "withheld", reason: "nothing is done" })
    expect(prepare(reg, "todo:sync", { done: 0, signedIn: false })).toEqual({ ok: false, id: "todo:sync", code: "withheld" })
    expect(prepare(reg, "todo:add", { done: 0 }, {})).toEqual({ ok: false, id: "todo:add", code: "args", issues: [{ arg: "title", problem: "missing" }] })
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
    const r = compose<Ctx, undefined>({ id: "x", run: () => { ran = true; return undefined }, enabled: () => false })
    expect(invoke(r, "x", { done: 0 }).ok).toBe(false)
    expect(ran).toBe(false)
  })
})
