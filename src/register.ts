import { nearCapabilityKey, type Verb } from "./verb.ts"

/**
 * The composed register: every verb a host knows, by id. Inert — no state, no subscription, no
 * loop — and built by **one act** (`compose`), which is the one place a duplicate id is refused.
 * Refusal is a luxury of host-scale composition: one point sees every claim.
 */
export interface Register<Ctx = unknown, Run = unknown> {
  readonly verbs: readonly Verb<Ctx, Run>[]
  get(id: string): Verb<Ctx, Run> | undefined
  has(id: string): boolean
  ids(): readonly string[]
}

/**
 * Compose verb sets into one register. Entries are plain data — a plugin exports an array, the
 * host composes — so re-keying, stripping or overriding is a `map` before composing, not an API.
 * Throws on a duplicate id: a surface silently invoking the wrong capability is the failure this
 * exists to make impossible. Throws as well on an id that is not a non-empty string (no surface
 * could summon it), an `on` that is not a list of tags, and an extra key that misspells a capability.
 */
export function compose<Ctx = unknown, Run = unknown>(
  // `never` admits a verb typed with any `Args`; in the register, args are what a surface sends.
  ...sets: readonly (Verb<Ctx, Run, never> | readonly Verb<Ctx, Run, never>[])[]
): Register<Ctx, Run> {
  const byId = new Map<string, Verb<Ctx, Run>>()
  for (const set of sets) {
    for (const verb of Array.isArray(set) ? (set as readonly Verb<Ctx, Run>[]) : [set as Verb<Ctx, Run>]) {
      check(verb as Verb<never, unknown, never>)
      if (byId.has(verb.id)) throw new Error(`verb id claimed twice: ${verb.id}`)
      byId.set(verb.id, verb)
    }
  }
  const verbs = Object.freeze([...byId.values()])
  return {
    verbs,
    get: (id) => byId.get(id),
    has: (id) => byId.has(id),
    ids: () => verbs.map((v) => v.id),
  }
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
