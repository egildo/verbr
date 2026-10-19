import { ARG_TYPES, type ArgTypes } from "./args.ts"
import { checkGuard, evaluate, type Verdict } from "./guard.ts"
import { nearCapabilityKey, type DomainMember, type Verb } from "./verb.ts"

/**
 * The words a host's declarations may use, handed to `compose` once and refused there when a
 * declaration names one the host does not hold. Each in its own nature: a `rule` and a list read
 * the context, for guards; a type is fixed, since what an email looks like does not change between
 * clicks; a domain's members are read from the context, since the people in this workspace or the
 * folders this user may file into are state.
 */
export interface Vocabulary<Ctx = unknown> {
  /** A guard's leaves. A rule reads its subject — the context at the top of a tree, an item inside a quantifier's `where` — and answers in three values. */
  readonly rules?: Readonly<Record<string, (subject: never, ctx: Ctx) => boolean | undefined>>
  /** The items a guard's quantifier counts over, or `undefined` when the host cannot say yet. */
  readonly lists?: Readonly<Record<string, (ctx: Ctx) => readonly unknown[] | undefined>>
  /** Argument types beyond, or replacing, the built-ins. */
  readonly types?: ArgTypes
  /** A named domain's members in this context, or `undefined` when the host cannot say yet — then the argument goes unchecked. */
  readonly domains?: Readonly<Record<string, (ctx: Ctx) => readonly DomainMember[] | undefined>>
}

/**
 * The composed register: every verb a host knows, by id, and the vocabulary its guards speak.
 * Inert — no state, no subscription, no loop — and built by **one act** (`compose`), which is the
 * one place a duplicate id or an unknown name is refused. Refusal is a luxury of host-scale
 * composition: one point sees every claim.
 */
export interface Register<Ctx = unknown, Run = unknown> {
  readonly verbs: readonly Verb<Ctx, Run>[]
  readonly vocabulary: Vocabulary<Ctx>
  get(id: string): Verb<Ctx, Run> | undefined
  has(id: string): boolean
  ids(): readonly string[]
}

/**
 * Compose verb sets into one register: the sets in a list, then the host's vocabulary — the same
 * shape as `applyTaste(register, documents, derivations)`, names in the declarations and functions
 * in the second slot. Entries are plain data — a plugin exports an array, the host composes — so
 * re-keying, stripping or overriding is a `map` before composing, not an API.
 *
 * Throws on a duplicate id: a surface silently invoking the wrong capability is the failure this
 * exists to make impossible. Throws as well on an id that is not a non-empty string (no surface
 * could summon it), an `on` that is not a list of tags, an extra key that misspells a capability,
 * and a guard that is malformed or names a rule or list the vocabulary does not hold — a guard
 * fails at build, never at a click.
 */
export function compose<Ctx = unknown, Run = unknown>(
  // `never` admits a verb typed with any `Args`; in the register, args are what a surface sends.
  sets: readonly (Verb<Ctx, Run, never> | readonly Verb<Ctx, Run, never>[])[],
  vocabulary: Vocabulary<Ctx> = {},
): Register<Ctx, Run> {
  const byId = new Map<string, Verb<Ctx, Run>>()
  for (const set of sets) {
    for (const verb of Array.isArray(set) ? (set as readonly Verb<Ctx, Run>[]) : [set as Verb<Ctx, Run>]) {
      check(verb as Verb<never, unknown, never>)
      if (byId.has(verb.id)) throw new Error(`verb id claimed twice: ${verb.id}`)
      if (verb.enabled !== undefined && typeof verb.enabled !== "function") checkGuard(verb.enabled, vocabulary as Vocabulary<never>, `verb "${verb.id}"`)
      checkArgNames(verb as Verb<never, unknown, never>, vocabulary as Vocabulary<never>)
      byId.set(verb.id, verb)
    }
  }
  const verbs = Object.freeze([...byId.values()])
  return {
    verbs,
    vocabulary,
    get: (id) => byId.get(id),
    has: (id) => byId.has(id),
    ids: () => verbs.map((v) => v.id),
  }
}

const has = (bag: object | undefined, name: string): boolean => bag !== undefined && Object.hasOwn(bag, name)

function checkArgNames(verb: Verb<never, unknown, never>, vocabulary: Vocabulary<never>): void {
  for (const arg of verb.args ?? []) {
    const at = `verb "${verb.id}" argument "${arg.name}"`
    if (arg.type !== undefined && !has(ARG_TYPES, arg.type) && !has(vocabulary.types, arg.type)) throw new Error(`${at} names unknown type "${arg.type}"`)
    if (typeof arg.domain === "string" && !has(vocabulary.domains, arg.domain)) throw new Error(`${at} names unknown domain "${arg.domain}"`)
    for (const key of ["members", "schema"]) if (key in arg) throw new Error(`${at} carries "${key}" — the projection writes it from the context`)
  }
}

/** A named domain's members for one context, each domain read at most once. */
export type Members = (domain: string) => readonly DomainMember[] | undefined

export function membersFor<Ctx>(vocabulary: Vocabulary<Ctx>, ctx: Ctx): Members {
  const seen = new Map<string, readonly DomainMember[] | undefined>()
  return (domain) => {
    if (!seen.has(domain)) seen.set(domain, has(vocabulary.domains, domain) ? vocabulary.domains![domain]!(ctx) : undefined)
    return seen.get(domain)
  }
}

/**
 * A verb's whole answer about one context — the one place availability is computed, so the
 * projection and `invoke` cannot disagree. The guard (or function) speaks first; a declared
 * `appliesTo` of none withholds whatever else was said; so does a required argument whose domain
 * is empty right now, with the domain as the cause. What the declarer named (`unavailable`,
 * `appliesTo`) beats what the guard deduced.
 */
export function verdictOf<Ctx>(verb: Verb<Ctx, unknown, never>, ctx: Ctx, vocabulary: Vocabulary<Ctx>, members: Members = membersFor(vocabulary, ctx)): Verdict {
  const declared = verb.appliesTo?.(ctx)
  const spoken: Verdict =
    verb.enabled === undefined ? { enabled: true } : typeof verb.enabled === "function" ? { enabled: verb.enabled(ctx) } : evaluate(verb.enabled, ctx, vocabulary)
  // Applying to none of the targets is the verb speaking: it cannot run here, whatever else it says.
  if (declared?.n === 0 || spoken.enabled === false) {
    const cause = verb.unavailable?.(ctx) ?? spoken.cause
    return { enabled: false, ...(cause ? { cause } : {}) }
  }
  // A required choice with nothing to choose from cannot run either; an unspoken domain is not empty.
  const empty = verb.args?.find((a) => a.required && typeof a.domain === "string" && members(a.domain)?.length === 0)
  if (empty) return { enabled: false, cause: empty.domain as string }
  const appliesTo = declared ?? spoken.appliesTo
  return { enabled: spoken.enabled, ...(appliesTo ? { appliesTo } : {}) }
}

function check(verb: Verb<never, unknown, never>): void {
  if (typeof verb.id !== "string" || verb.id === "") throw new Error(`verb id must be a non-empty string, got ${JSON.stringify(verb.id)}`)
  const on: unknown = verb.on
  if (on !== undefined && !(Array.isArray(on) && on.every((t) => typeof t === "string"))) throw new Error(`verb "${verb.id}" declares \`on\` that is not a list of tags`)
  for (const key of Object.keys(verb)) {
    const near = nearCapabilityKey(key)
    if (near) throw new Error(`verb "${verb.id}" carries "${key}" — did you mean the capability key "${near}"?`)
  }
}
