import { describe, expect, it } from "vitest"
import { evaluate, type Guard } from "./guard.ts"
import { flat, project } from "./project.ts"
import { compose, type Vocabulary } from "./register.ts"
import { applyTaste } from "./taste.ts"

/** A context whose rules answer whatever the test says, including silence. */
interface Ctx { readonly says: Readonly<Record<string, boolean | undefined>>; readonly targets?: readonly Doc[] }
interface Doc { readonly id: string; readonly signable?: boolean | undefined }
const vocabulary: Vocabulary<Ctx> = {
  rules: {
    a: (c: Ctx) => c.says["a"], b: (c: Ctx) => c.says["b"], locked: (c: Ctx) => c.says["locked"],
    signable: (d: Doc) => d.signable,
  },
  lists: { targets: (c) => c.targets },
}
const T = true, F = false, U = undefined
const at = (a: boolean | undefined, b: boolean | undefined): Ctx => ({ says: { a, b } })
const value = (g: Guard, ctx: Ctx) => evaluate(g, ctx, vocabulary).enabled

describe("Kleene's strong three-valued logic", () => {
  // [a, b, all, any] — the full truth table; silence is never read as a no.
  const table: [boolean | undefined, boolean | undefined, boolean | undefined, boolean | undefined][] = [
    [T, T, T, T], [T, F, F, T], [T, U, U, T],
    [F, T, F, T], [F, F, F, F], [F, U, F, U],
    [U, T, U, T], [U, F, F, U], [U, U, U, U],
  ]
  it.each(table)("a=%s b=%s → all %s, any %s", (a, b, all, any) => {
    expect(value({ all: [{ rule: "a" }, { rule: "b" }] }, at(a, b))).toBe(all)
    expect(value({ any: [{ rule: "a" }, { rule: "b" }] }, at(a, b))).toBe(any)
  })
  it("not of the unspoken is unspoken", () => {
    expect(value({ not: { rule: "a" } }, at(U, U))).toBe(U)
    expect(value({ not: { rule: "a" } }, at(T, U))).toBe(F)
  })
})

describe("quantifiers count the passes; unknown items widen the count, never shrink it", () => {
  const docs = (...s: (boolean | undefined)[]): Ctx => ({ says: {}, targets: s.map((signable, i) => ({ id: `d${i}`, signable })) })
  const q = (g: Guard, ctx: Ctx) => value(g, ctx)
  it("every: all of a non-empty list", () => {
    expect(q({ every: "targets", where: { rule: "signable" } }, docs(T, T))).toBe(T)
    expect(q({ every: "targets", where: { rule: "signable" } }, docs(T, F, U))).toBe(F)
    expect(q({ every: "targets", where: { rule: "signable" } }, docs(T, U))).toBe(U)
    expect(q({ every: "targets", where: { rule: "signable" } }, docs())).toBe(F)
  })
  it("some, one, many over the range of possible counts", () => {
    expect(q({ some: "targets", where: { rule: "signable" } }, docs(F, U))).toBe(U)
    expect(q({ some: "targets", where: { rule: "signable" } }, docs(F, T))).toBe(T)
    expect(q({ one: "targets", where: { rule: "signable" } }, docs(T, U))).toBe(U)
    expect(q({ one: "targets", where: { rule: "signable" } }, docs(T, T, U))).toBe(F)
    expect(q({ many: "targets" }, docs(F, F))).toBe(T) // no `where`: a multiple selection
  })
  it("a list the host cannot give yet is unspoken", () => expect(q({ some: "targets" }, { says: {} })).toBe(U))
})

describe("the «n of N» is deduced from the one `some` on the all spine", () => {
  const ctx: Ctx = { says: { a: true }, targets: [{ id: "1", signable: true }, { id: "2", signable: false }, { id: "3", signable: true }] }
  it("counts the passes when the guard holds", () => {
    expect(evaluate({ all: [{ rule: "a" }, { some: "targets", where: { rule: "signable" } }] }, ctx, vocabulary).appliesTo).toEqual({ n: 2, of: 3 })
  })
  it("says nothing when two quantifiers could be meant, when the one is not `some`, or when the guard fails", () => {
    expect(evaluate({ all: [{ some: "targets" }, { some: "targets", where: { rule: "signable" } }] }, ctx, vocabulary).appliesTo).toBeUndefined()
    expect(evaluate({ every: "targets" }, ctx, vocabulary).appliesTo).toBeUndefined()
    expect(evaluate({ all: [{ not: { rule: "a" } }, { some: "targets" }] }, ctx, vocabulary).appliesTo).toBeUndefined()
  })
})

describe("the cause is the first leaf that made the guard false", () => {
  const cause = (g: Guard, ctx: Ctx) => evaluate(g, ctx, vocabulary).cause
  it("all: the first false branch; not: the rule that held; every: the first failing item's rule", () => {
    expect(cause({ all: [{ rule: "a" }, { rule: "b" }] }, at(T, F))).toBe("b")
    expect(cause({ not: { rule: "locked" } }, { says: { locked: true } })).toBe("locked")
    expect(cause({ every: "targets", where: { rule: "signable" } }, { says: {}, targets: [{ id: "1", signable: true }, { id: "2", signable: false }] })).toBe("signable")
  })
  it("any and some: every branch failed, so no single culprit", () => {
    expect(cause({ any: [{ rule: "a" }, { rule: "b" }] }, at(F, F))).toBeUndefined()
    expect(cause({ some: "targets", where: { rule: "signable" } }, { says: {}, targets: [{ id: "1", signable: false }] })).toBeUndefined()
  })
})

describe("through the projection", () => {
  const reg = compose<Ctx, unknown>([
    { id: "document:sign", run: () => 0, enabled: { all: [{ not: { rule: "locked" } }, { some: "targets", where: { rule: "signable" } }] } },
    { id: "document:archive", run: () => 0, enabled: { not: { rule: "locked" } }, unavailable: () => "archived" },
  ], vocabulary)
  const taste = applyTaste(reg, [{ reasons: { locked: "The document is locked" } }, { name: "it", reasons: { locked: "Il documento è bloccato" } }])
  const views = (ctx: Ctx) => Object.fromEntries(flat(project(reg, ctx, taste, { includeUnavailable: true })).map((v) => [v.id, v]))
  it("taste words the failed rule; the last document wins; a declared name beats a deduced one, humanized when unworded", () => {
    const v = views({ says: { locked: true }, targets: [] })
    expect(v["document:sign"]).toMatchObject({ enabled: false, cause: "locked", reason: "Il documento è bloccato" })
    expect(v["document:archive"]).toMatchObject({ enabled: false, cause: "archived", reason: "Archived" })
  })
  it("a camelCase rule reads as words when nobody worded it", () => {
    expect(applyTaste(reg, {}).reasonOf("inFolderInView")).toBe("In folder in view")
  })
  it("the deduced count reaches the control", () => {
    const v = views({ says: { locked: false }, targets: [{ id: "1", signable: true }, { id: "2", signable: false }] })
    expect(v["document:sign"]).toMatchObject({ enabled: true, appliesTo: { n: 1, of: 2 } })
  })
})

describe("refusals — at build, never at a click", () => {
  it("an unknown rule, an unknown list, a tree that is not a guard", () => {
    expect(() => compose([{ id: "x", run: () => 0, enabled: { rule: "nope" } }], vocabulary)).toThrow(/verb "x": names unknown rule "nope"/)
    expect(() => compose([{ id: "x", run: () => 0, enabled: { some: "rows" } }], vocabulary)).toThrow(/unknown list "rows"/)
    expect(() => compose([{ id: "x", run: () => 0, enabled: { alll: [] } as unknown as Guard }], vocabulary)).toThrow(/not a guard/)
  })
  it("a guard with no vocabulary at all names nothing the host holds", () => {
    expect(() => compose([{ id: "x", run: () => 0, enabled: { rule: "a" } }])).toThrow(/unknown rule "a"/)
  })
})
