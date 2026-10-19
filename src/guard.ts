import type { Vocabulary } from "./register.ts"

/**
 * **Availability as data.** A guard is a tree any reader can walk without running the host: a
 * bench, a test, an agent. verbr owns the grammar — `all`, `any`, `not`, and four quantifiers over
 * a list — and the host owns the words: every `rule` and every list is a **name** the host resolves
 * in the register's vocabulary, refused at build when the host does not hold it. The same split as
 * taste's derivations: data as far as the vocabulary reaches, code by name beyond it.
 *
 * The logic is **Kleene's strong three-valued logic**, the one SQL uses for NULL, because a verb's
 * availability has three answers: `true`, `false`, and `undefined` — the authority has not spoken.
 * `all` is false as soon as one branch is false, unspoken otherwise if one branch is; `any` mirrors
 * it; `not` of the unspoken is unspoken. Silence is never read as a no.
 */
export type Guard =
  | { readonly all: readonly Guard[] }
  | { readonly any: readonly Guard[] }
  | { readonly not: Guard }
  | { readonly rule: string }
  | Quantified

/**
 * How many items of a list must pass `where`: `every` (all of a non-empty list), `some` (at least
 * one), `one` (exactly one), `many` (at least two). `where` absent passes every item, so
 * `{ many: "targets" }` reads «a multiple selection».
 */
export type Quantifier = "every" | "some" | "one" | "many"
export type Quantified =
  | { readonly every: string; readonly where?: Guard }
  | { readonly some: string; readonly where?: Guard }
  | { readonly one: string; readonly where?: Guard }
  | { readonly many: string; readonly where?: Guard }

/** What a guard — or a whole verb, through the register's `verdictOf` — says of one context. */
export interface Verdict {
  readonly enabled: boolean | undefined
  /** Why not, as a name for taste to word: the rule that made the guard false, or what `unavailable` named. Absent when no single leaf is to blame. */
  readonly cause?: string
  /** «n of N»: present when the guard holds and exactly one quantifier sits on its `all` spine, and that quantifier is `some`. */
  readonly appliesTo?: { readonly n: number; readonly of: number }
}

const QUANTIFIERS: readonly Quantifier[] = ["every", "some", "one", "many"]
const NODES = ["all", "any", "not", "rule", ...QUANTIFIERS] as const

function quantifierOf(g: Guard): Quantifier | undefined {
  return QUANTIFIERS.find((q) => q in g)
}

/** Refuse, at build, a tree that is not a guard or names a rule or list the host does not hold. */
export function checkGuard(g: Guard, vocabulary: Vocabulary<never>, at: string): void {
  const node = typeof g === "object" && g !== null ? NODES.find((k) => k in g) : undefined
  if (!node) throw new Error(`${at}: not a guard: ${JSON.stringify(g)}`)
  if ("all" in g) g.all.forEach((c) => checkGuard(c, vocabulary, at))
  else if ("any" in g) g.any.forEach((c) => checkGuard(c, vocabulary, at))
  else if ("not" in g) checkGuard(g.not, vocabulary, at)
  else if ("rule" in g) {
    if (!(g.rule in (vocabulary.rules ?? {}))) throw new Error(`${at}: names unknown rule "${g.rule}"`)
  } else {
    const list = (g as Record<string, unknown>)[node] as string
    if (!(list in (vocabulary.lists ?? {}))) throw new Error(`${at}: names unknown list "${list}"`)
    if (g.where) checkGuard(g.where, vocabulary, at)
  }
}

interface Step { readonly value: boolean | undefined; readonly cause?: string }
type Counts = Map<Guard, { n: number; of: number }>

function step<Ctx>(g: Guard, subject: unknown, ctx: Ctx, vocabulary: Vocabulary<Ctx>, counts: Counts): Step {
  if ("rule" in g) {
    const value = (vocabulary.rules![g.rule] as (s: unknown, c: Ctx) => boolean | undefined)(subject, ctx)
    return value === false ? { value, cause: g.rule } : { value }
  }
  if ("all" in g) {
    let unspoken = false
    for (const c of g.all) {
      const s = step(c, subject, ctx, vocabulary, counts)
      if (s.value === false) return s
      if (s.value === undefined) unspoken = true
    }
    return { value: unspoken ? undefined : true }
  }
  if ("any" in g) {
    let unspoken = false
    for (const c of g.any) {
      const s = step(c, subject, ctx, vocabulary, counts)
      if (s.value === true) return { value: true }
      if (s.value === undefined) unspoken = true
    }
    // Every branch cause: no single culprit, so no reason.
    return { value: unspoken ? undefined : false }
  }
  if ("not" in g) {
    const s = step(g.not, subject, ctx, vocabulary, counts)
    if (s.value === undefined) return { value: undefined }
    // `not locked` fails because `locked` held: the rule is the culprit. Deeper than a rule, nobody is.
    return s.value ? ("rule" in g.not ? { value: false, cause: g.not.rule } : { value: false }) : { value: true }
  }
  const q = quantifierOf(g)!
  const items = vocabulary.lists![(g as Record<string, unknown>)[q] as string]!(ctx)
  if (items === undefined) return { value: undefined }
  let yes = 0
  let unspoken = 0
  let firstCause: string | undefined
  for (const item of items) {
    const s = g.where ? step(g.where, item, ctx, vocabulary, counts) : { value: true }
    if (s.value === true) yes++
    else if (s.value === undefined) unspoken++
    else firstCause ??= s.cause
  }
  counts.set(g, { n: yes, of: items.length })
  const holds = (k: number) => (q === "every" ? items.length > 0 && k === items.length : q === "some" ? k >= 1 : q === "one" ? k === 1 : k >= 2)
  // The true count lies in [yes, yes + unspoken]: known only if every count in that range agrees.
  let some = false
  let none = false
  for (let k = yes; k <= yes + unspoken; k++) {
    if (holds(k)) some = true
    else none = true
  }
  const value = some && none ? undefined : some
  // Only `every` has one item to blame; `some` failing is every item failing, like `any`.
  return value === false && q === "every" && firstCause ? { value, cause: firstCause } : { value }
}

function spine(g: Guard): readonly Guard[] {
  return "all" in g ? g.all.flatMap(spine) : [g]
}

/** Evaluate a guard against a context. Pure: the host's rules and lists are the only code it calls. */
export function evaluate<Ctx>(g: Guard, ctx: Ctx, vocabulary: Vocabulary<Ctx>): Verdict {
  const counts: Counts = new Map()
  const { value, cause } = step(g, ctx, ctx, vocabulary, counts)
  const quantified = spine(g).filter((n) => quantifierOf(n) !== undefined)
  const only = quantified.length === 1 && "some" in quantified[0]! ? counts.get(quantified[0]!) : undefined
  return {
    enabled: value,
    ...(cause ? { cause } : {}),
    ...(value === true && only ? { appliesTo: only } : {}),
  }
}

