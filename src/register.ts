import type { Verb } from "./verb.ts"

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
 * exists to make impossible.
 */
export function compose<Ctx = unknown, Run = unknown>(
  ...sets: readonly (Verb<Ctx, Run> | readonly Verb<Ctx, Run>[])[]
): Register<Ctx, Run> {
  const byId = new Map<string, Verb<Ctx, Run>>()
  for (const set of sets) {
    for (const verb of Array.isArray(set) ? (set as readonly Verb<Ctx, Run>[]) : [set as Verb<Ctx, Run>]) {
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
