import { describe, expect, it } from "vitest"
import { argsSchema, checkArgs } from "./args.ts"
import type { VerbArg } from "./verb.ts"

const args: readonly VerbArg[] = [
  { name: "title", type: "text", required: true, label: "Title", description: "What to do" },
  { name: "due", type: "date" },
  { name: "priority", domain: [{ value: "low" }, { value: "high" }] },
  { name: "owner", domain: "people" },
  { name: "estimate", type: "story-points" },
]

describe("checkArgs", () => {
  it("passes what fits, with optional args left out", () => {
    expect(checkArgs(args, { title: "Buy milk" })).toEqual([])
    expect(checkArgs(args, { title: "x", due: "2026-09-22", priority: "high", owner: "anyone", estimate: { any: "thing" } })).toEqual([])
  })
  it("names what is missing, undeclared, mistyped or outside its domain", () => {
    expect(checkArgs(args, { titel: "x", due: "tomorrow", priority: "urgent" })).toEqual([
      { arg: "titel", problem: "undeclared" },
      { arg: "title", problem: "missing" },
      { arg: "due", problem: "type", expected: "date" },
      { arg: "priority", problem: "domain", expected: ["low", "high"] },
    ])
  })
  it("checks a named domain when the host lists it, and a host type by name", () => {
    const o = { domains: { people: [{ value: "ada" }] }, types: { "story-points": { check: (v: unknown) => [1, 2, 3, 5, 8].includes(v as number), schema: { type: "integer" } } } }
    expect(checkArgs(args, { title: "x", owner: "bob", estimate: 4 }, o)).toEqual([
      { arg: "owner", problem: "domain", expected: ["ada"] },
      { arg: "estimate", problem: "type", expected: "story-points" },
    ])
  })
  it("refuses any arg to a verb that declares none", () => {
    expect(checkArgs(undefined, { x: 1 })).toEqual([{ arg: "x", problem: "undeclared" }])
    expect(checkArgs(undefined, undefined)).toEqual([])
  })
  it("the built-in types hold their line", () => {
    const one = (type: string, value: unknown) => checkArgs([{ name: "v", type }], { v: value }).length === 0
    expect([one("number", 1), one("number", Number.NaN), one("integer", 1.5), one("boolean", "true")]).toEqual([true, false, false, false])
    expect([one("url", "https://x.dev/a"), one("url", "x.dev"), one("email", "a@b"), one("datetime", "2026-09-22T10:00:00Z")]).toEqual([true, false, true, true])
  })
})

describe("argsSchema", () => {
  it("states args as one JSON Schema object", () => {
    expect(argsSchema(args, { domains: { people: [{ value: "ada" }] } })).toEqual({
      type: "object",
      properties: {
        title: { type: "string", title: "Title", description: "What to do" },
        due: { type: "string", format: "date" },
        priority: { type: "string", enum: ["low", "high"] },
        owner: { type: "string", enum: ["ada"] },
        estimate: {},
      },
      required: ["title"],
      additionalProperties: false,
    })
  })
  it("names an unlisted domain in words, and takes nothing when there are no args", () => {
    expect(argsSchema([{ name: "owner", domain: "people" }]).properties).toEqual({ owner: { description: 'A member of the host\'s "people" domain.' } })
    expect(argsSchema(undefined)).toEqual({ type: "object", properties: {}, additionalProperties: false })
  })
})
