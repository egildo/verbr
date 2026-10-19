import { describe, expect, it } from "vitest"
import { invoke } from "./invoke.ts"
import { flat, project } from "./project.ts"
import { compose, type Vocabulary } from "./register.ts"
import { applyTaste } from "./taste.ts"
import { manifest } from "./tools.ts"
import type { Verb } from "./verb.ts"

/** A host whose folders are state: the ones this user may file into, or unknown while loading. */
interface Ctx { readonly folders?: readonly string[] }
let reads = 0
const vocabulary: Vocabulary<Ctx> = {
  types: { points: { check: (v) => [1, 2, 3, 5, 8].includes(v as number), schema: { type: "integer", enum: [1, 2, 3, 5, 8] } } },
  domains: { folders: (c) => { reads++; return c.folders?.map((value) => ({ value })) } },
}
const verbs: Verb<Ctx, string>[] = [
  { id: "doc:file", run: (_c, a) => `file in ${String(a?.["folder"])}`, args: [{ name: "folder", domain: "folders", required: true }] },
  { id: "doc:move", run: () => "move", args: [{ name: "folder", domain: "folders", required: true }, { name: "note", type: "text" }] },
  { id: "doc:estimate", run: () => "estimate", args: [{ name: "size", type: "points" }] },
]
const reg = compose([verbs], vocabulary)
const taste = applyTaste(reg, { reasons: { folders: "No folder to file into" } })
const controls = (ctx: Ctx) => Object.fromEntries(flat(project(reg, ctx, taste, { includeUnavailable: true })).map((c) => [c.id, c]))

describe("names are refused at compose, never at a click", () => {
  it("an unknown type or domain, and a declaration stating what the projection writes", () => {
    expect(() => compose([{ id: "x", run: () => 0, args: [{ name: "n", type: "story-points" }] }])).toThrow(/argument "n" names unknown type "story-points"/)
    expect(() => compose([{ id: "x", run: () => 0, args: [{ name: "who", domain: "people" }] }])).toThrow(/names unknown domain "people"/)
    expect(() => compose([{ id: "x", run: () => 0, args: [{ name: "f", domain: "folders", members: [] }] }], vocabulary)).toThrow(/carries "members"/)
  })
  it("a built-in type or a host's own composes", () => {
    expect(() => compose([{ id: "x", run: () => 0, args: [{ name: "n", type: "number" }, { name: "s", type: "points" }] }], vocabulary)).not.toThrow()
  })
})

describe("a domain is read from the context, once per projection", () => {
  it("the projection carries members and a schema; a surface and an agent read the same", () => {
    reads = 0
    const c = controls({ folders: ["inbox", "archive"] })
    expect(reads).toBe(1)
    expect(c["doc:file"]?.args?.[0]).toMatchObject({ domain: "folders", members: [{ value: "inbox" }, { value: "archive" }], schema: { type: "string", enum: ["inbox", "archive"] } })
    const tools = manifest(project(reg, { folders: ["inbox"] }, taste)).tools
    expect(tools.find((t) => t.name === "doc_file")?.inputSchema).toEqual({ type: "object", properties: { folder: { type: "string", enum: ["inbox"] } }, required: ["folder"], additionalProperties: false })
    expect(tools.find((t) => t.name === "doc_estimate")?.inputSchema["properties"]).toEqual({ size: { type: "integer", enum: [1, 2, 3, 5, 8] } })
  })
  it("invoke checks against the same members and types, with no options", () => {
    expect(invoke(reg, "doc:file", { folders: ["inbox"] }, { folder: "inbox" })).toEqual({ ok: true, id: "doc:file", value: "file in inbox" })
    expect(invoke(reg, "doc:file", { folders: ["inbox"] }, { folder: "trash" })).toMatchObject({ ok: false, code: "args", issues: [{ arg: "folder", problem: "domain", expected: ["inbox"] }] })
    expect(invoke(reg, "doc:estimate", {}, { size: 4 })).toMatchObject({ ok: false, code: "args", issues: [{ arg: "size", problem: "type", expected: "points" }] })
  })
})

describe("an empty required domain withholds; an unspoken one does not", () => {
  it("nothing to choose from: withheld, with the domain as the cause", () => {
    const c = controls({ folders: [] })
    expect(c["doc:file"]).toMatchObject({ enabled: false, cause: "folders", reason: "No folder to file into" })
    expect(c["doc:estimate"]?.enabled).toBe(true)
    expect(invoke(reg, "doc:move", { folders: [] }, { folder: "x" })).toEqual({ ok: false, id: "doc:move", code: "withheld", cause: "folders", reason: "Folders" })
  })
  it("a domain the host cannot say yet: offered, no members, the argument unchecked", () => {
    const c = controls({})
    expect(c["doc:file"]?.enabled).toBe(true)
    expect(c["doc:file"]?.args?.[0]).not.toHaveProperty("members")
    expect(invoke(reg, "doc:file", {}, { folder: "anything" }).ok).toBe(true)
  })
})
