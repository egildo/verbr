import { CAPABILITY_KEYS, PROJECTED_KEYS, isKind, kindOf, nearCapabilityKey, type Kind, type Verb } from "./verb.ts"
import type { Register } from "./register.ts"

/**
 * **Taste is a document.** Everything a host decides about a verb that is not what it does: what
 * to call it, which picture it wears, which chord answers to it, which section it sits in, how it
 * is drawn. A document has two sections and a section list. `verbs` holds per-verb opinions keyed
 * by id. `layers` holds rules that apply to many verbs at once, in order, later winning per key.
 * `sections` names the groups a surface may lay verbs out in. Several documents stack root-first:
 * a house file, a product file, a language file — the same shape at every depth.
 *
 * The document is **readable data**: no function anywhere in it. A rule selects verbs with a
 * {@link Where}, and a value is a literal or a {@link Derivation} naming a function the host holds.
 * That is what lets a bench, a test, or an agent read a host's taste without running the host.
 */
export interface Taste {
  /** For `describe`: which document a claim came from. Defaults to `taste`, numbered when several are anonymous. */
  readonly name?: string
  readonly verbs?: Readonly<Record<string, Attrs>>
  readonly layers?: readonly Layer[]
  readonly sections?: readonly Section[]
}

/** A bag of taste. Open by construction; the capability keys are refused at build. */
export type Attrs = Readonly<Record<string, unknown>>

/**
 * One rule: for every verb `where` selects, set these `attrs`. A layer sees the register **as
 * resolved so far**, so a later rule may match on what an earlier one derived (*everything docked
 * goes behind the menu*) — judgements compose instead of being restated per verb.
 */
export interface Layer {
  readonly name: string
  /** Absent selects every verb. */
  readonly where?: Where
  readonly attrs: Attrs
}

/**
 * The selection vocabulary — attribute equality, like a query's `where`. Three keys read the
 * declaration: `id` (exact, or a glob with one trailing `*`: `table:*`), `kind` (the deduced
 * {@link Kind}), `argType` (the first argument's `type`). Every other key reads an attribute an
 * earlier layer resolved. `null` matches an absent attribute (or one resolved to `null`). No other
 * capability or projected key may be selected on — nothing would ever match it, so it is refused.
 * Deliberately not a selector language: no specificity, order is the only precedence.
 */
export interface Where {
  readonly id?: string
  readonly kind?: Kind
  readonly argType?: string
  readonly [attr: string]: unknown
}

/** A value computed by a function the host holds, referred to **by name** — the Law's split: data as far as it reaches, code by name beyond. */
export interface Derivation {
  readonly derive: string
}

/** A section a surface may group verbs under. `parent` nests; `label`, `icon`, `as` and the rest are taste. */
export interface Section {
  readonly id: string
  readonly parent?: string
  readonly [attr: string]: unknown
}

/** The named functions a host holds for {@link Derivation}s. `humanize` is built in. */
export type Derivations = Readonly<Record<string, (verb: Verb<never, unknown, never>, resolved: Attrs) => unknown>>

/** One claim on one attribute, as `describe` reports it, in court order. */
export interface Claim {
  readonly layer: string
  readonly key: string
  readonly value: unknown
  readonly wins: boolean
}

/**
 * The register with its taste resolved, plus **sight**: `describe` answers, for any verb, which
 * layer claimed which attribute and who won; `audit` sweeps every contested pair; `orphans` lists
 * the taste that reached no verb. A cascade owes sight, not refusal — the first time a control turns
 * up somewhere you did not put it, or fails to turn up where you did, this is the instrument you want.
 */
export interface Attributed {
  /** Whether the register this taste was applied to holds the verb. */
  has(id: string): boolean
  attrsOf(id: string): Attrs
  describe(id: string, key?: string): readonly Claim[]
  audit(): readonly { readonly id: string; readonly key: string; readonly claims: readonly Claim[] }[]
  /**
   * Taste that reached nothing: a `verbs` entry naming an id the register does not hold (`id` set),
   * or a layer whose `where` selected no verb (`id` absent). Not refused — a house file may speak of
   * verbs this host never composed — but seen.
   */
  orphans(): readonly Orphan[]
  readonly sections: readonly Section[]
}

/** Taste that reached no verb, as {@link Attributed.orphans} reports it. */
export interface Orphan {
  readonly layer: string
  readonly id?: string
}

/** A label from an id, for a register nobody has named yet: `table:add-row-after` → `Add row after`. */
export function humanize(id: string): string {
  const local = id.slice(id.lastIndexOf(":") + 1)
  const words = local.split(/[-_]/).filter(Boolean).join(" ")
  return words ? words[0]!.toUpperCase() + words.slice(1) : id
}

const BUILT_IN: Derivations = { humanize: (verb) => humanize(verb.id) }

/**
 * The naming default, seated first so it is overridable by anything and visible in `describe`. It
 * applies only where no label was declared — `where: { label: null }` — so a declarer's own word is
 * the floor and the default fills the gaps, said as data like every other layer.
 */
export const NAMING: Layer = { name: "naming", where: { label: null }, attrs: { label: { derive: "humanize" } } }

function isDerivation(v: unknown): v is Derivation {
  return typeof v === "object" && v !== null && typeof (v as Derivation).derive === "string"
}

function matchesId(pattern: string, id: string): boolean {
  if (pattern.endsWith("*")) return id.startsWith(pattern.slice(0, -1))
  return pattern === id
}

function checkWhere(court: string, where: Where): void {
  for (const [key, want] of Object.entries(where)) {
    if (key === "id") {
      if (typeof want !== "string") throw new Error(`taste layer "${court}" selects on an id that is not a string`)
    } else if (key === "kind") {
      if (!isKind(want)) throw new Error(`taste layer "${court}" selects on unknown kind ${JSON.stringify(want)} — a kind is action, toggle, choice or value`)
    } else if (CAPABILITY_KEYS.has(key) || PROJECTED_KEYS.has(key)) {
      throw new Error(`taste layer "${court}" selects on "${key}" — a layer sees taste and the declaration's shape, never the capability or the context`)
    }
  }
}

function checkKey(owner: string, key: string): void {
  if (CAPABILITY_KEYS.has(key)) throw new Error(`${owner} reaches capability key "${key}" — taste may rename a verb, never redefine what it does`)
  if (PROJECTED_KEYS.has(key)) throw new Error(`${owner} reaches projected key "${key}" — the projection reads it from the context, taste may not state it`)
  const near = nearCapabilityKey(key)
  if (near) throw new Error(`${owner} states "${key}" — did you mean the capability key "${near}"? Taste may not reach it either way`)
}

function matches(where: Where | undefined, verb: Verb<never, unknown, never>, resolved: Attrs): boolean {
  if (!where) return true
  for (const [key, want] of Object.entries(where)) {
    if (key === "id") {
      if (typeof want !== "string" || !matchesId(want, verb.id)) return false
    } else if (key === "kind") {
      if (kindOf(verb) !== want) return false
    } else if (key === "argType") {
      if (verb.args?.[0]?.type !== want) return false
    } else {
      const have = resolved[key]
      if (want === null ? have != null : have !== want) return false
    }
  }
  return true
}

/**
 * Apply taste to a register. The cascade is `NAMING`, then for each document its `verbs` section
 * (one layer of per-id claims) and then its `layers`, in order; later wins per key. Throws at build
 * for a layer that reaches or selects on a capability key or a projected key, names a derivation the
 * host does not hold, or places a verb in a section no document declared (and for a section whose
 * `parent` is undeclared or loops) — a closed vocabulary with a loud diagnostic, never a silent guess.
 */
export function applyTaste<Ctx, Run>(
  register: Register<Ctx, Run>,
  tastes: Taste | readonly Taste[],
  derivations: Derivations = {},
): Attributed {
  const docs = Array.isArray(tastes) ? (tastes as readonly Taste[]) : [tastes as Taste]
  const derive: Derivations = { ...BUILT_IN, ...derivations }

  interface Court { readonly name: string; readonly where: Where | undefined; readonly attrs: Attrs; readonly perId?: Readonly<Record<string, Attrs>> }
  const courts: Court[] = [{ name: NAMING.name, where: NAMING.where, attrs: NAMING.attrs }]
  docs.forEach((doc, i) => {
    const docName = doc.name ?? (docs.length === 1 ? "taste" : `taste-${i + 1}`)
    if (doc.verbs) courts.push({ name: `${docName}:verbs`, where: undefined, attrs: {}, perId: doc.verbs })
    for (const layer of doc.layers ?? []) courts.push({ name: `${docName}:${layer.name}`, where: layer.where, attrs: layer.attrs })
  })
  const known = (value: unknown, owner: string): void => {
    if (isDerivation(value) && !Object.hasOwn(derive, value.derive)) throw new Error(`${owner} names unknown derivation "${value.derive}"`)
  }
  for (const court of courts) {
    if (court.where) checkWhere(court.name, court.where)
    const bags = court.perId ? Object.values(court.perId) : [court.attrs]
    for (const bag of bags) {
      for (const [key, value] of Object.entries(bag)) {
        checkKey(`taste layer "${court.name}"`, key)
        known(value, `taste layer "${court.name}"`)
      }
    }
  }

  const sections = new Map<string, Section>()
  for (const doc of docs) for (const s of doc.sections ?? []) sections.set(s.id, { ...sections.get(s.id), ...s })
  for (const s of sections.values()) {
    const seen = new Set<string>([s.id])
    for (let p = s.parent; p !== undefined; p = sections.get(p)?.parent) {
      if (!sections.has(p)) throw new Error(`section "${s.id}" names undeclared parent "${p}"`)
      if (seen.has(p)) throw new Error(`section "${s.id}" sits in a loop of parents`)
      seen.add(p)
    }
  }
  const resolve = (raw: unknown, verb: Verb<never, unknown, never>, resolved: Attrs): unknown =>
    isDerivation(raw) ? derive[raw.derive]!(verb, resolved) : raw

  const reached = new Set<Court>()
  const claims = new Map<string, Claim[]>()
  const attrs = new Map<string, Attrs>()
  for (const verb of register.verbs as readonly Verb<never, unknown, never>[]) {
    const mine: Claim[] = []
    let resolved: Record<string, unknown> = {}
    // The declaration's own taste is the floor: whatever the declarer carried beyond the capability keys.
    for (const [key, raw] of Object.entries(verb)) {
      if (PROJECTED_KEYS.has(key)) throw new Error(`verb "${verb.id}" declares projected key "${key}" — the projection reads it from the context`)
      if (CAPABILITY_KEYS.has(key)) continue
      known(raw, `verb "${verb.id}"`)
      const value = resolve(raw, verb, resolved)
      resolved[key] = value
      mine.push({ layer: "declared", key, value, wins: true })
    }
    for (const court of courts) {
      const bag = court.perId ? (Object.hasOwn(court.perId, verb.id) ? court.perId[verb.id] : undefined) : matches(court.where, verb, resolved) ? court.attrs : undefined
      if (!bag) continue
      reached.add(court)
      for (const [key, raw] of Object.entries(bag)) {
        const value = resolve(raw, verb, resolved)
        resolved = { ...resolved, [key]: value }
        mine.push({ layer: court.name, key, value, wins: true })
      }
    }
    const section = resolved["section"]
    if (typeof section === "string" && !sections.has(section)) throw new Error(`verb "${verb.id}" is placed in section "${section}", which no taste document declares`)
    // The last claim per key wins; mark the rest.
    const lastFor = new Map<string, number>()
    mine.forEach((c, i) => lastFor.set(c.key, i))
    const marked = mine.map((c, i) => (lastFor.get(c.key) === i ? c : { ...c, wins: false }))
    claims.set(verb.id, marked)
    attrs.set(verb.id, Object.freeze(resolved))
  }

  const orphans: Orphan[] = []
  for (const court of courts) {
    if (court.perId) for (const id of Object.keys(court.perId)) { if (!register.has(id)) orphans.push({ layer: court.name, id }) }
    else if (court.name !== NAMING.name && !reached.has(court)) orphans.push({ layer: court.name })
  }

  return {
    has: (id) => attrs.has(id),
    attrsOf: (id) => attrs.get(id) ?? {},
    describe: (id, key) => (claims.get(id) ?? []).filter((c) => key === undefined || c.key === key),
    audit: () => {
      const out: { id: string; key: string; claims: Claim[] }[] = []
      for (const [id, list] of claims) {
        const byKey = new Map<string, Claim[]>()
        for (const c of list) byKey.set(c.key, [...(byKey.get(c.key) ?? []), c])
        for (const [key, cs] of byKey) if (cs.length > 1) out.push({ id, key, claims: cs })
      }
      return out
    },
    orphans: () => orphans,
    sections: [...sections.values()],
  }
}
