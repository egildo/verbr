import { checkArgs, type ArgIssue, type Domains } from "./args.ts"
import { membersFor, verdictOf, type Register } from "./register.ts"
import { sentence, type Attributed } from "./taste.ts"
import type { Verb } from "./verb.ts"

/**
 * Why a verb will not run, as plain data — the same answer for a button, a chord, a palette and an
 * agent's tool call, since they all arrive as an id and a bag of args.
 *
 * - `unknown`: no verb has this id.
 * - `inapplicable`: the verb does not live in this context (`on`).
 * - `withheld`: `enabled` said `false`, or `appliesTo` said none. `cause` names why, when a guard
 *   found a rule false or `unavailable` named it; `reason` is that cause in words — taste's, when
 *   the caller passed it, else humanized — the same pair a {@link Control} carries.
 * - `unspoken`: `enabled` has not spoken and the caller asked for that to count as no.
 * - `args`: the args do not fit the declaration; `issues` says how.
 */
export type Refusal =
  | { readonly ok: false; readonly id: string; readonly code: "unknown" | "inapplicable" | "unspoken" }
  | { readonly ok: false; readonly id: string; readonly code: "withheld"; readonly cause?: string; readonly reason?: string }
  | { readonly ok: false; readonly id: string; readonly code: "args"; readonly issues: readonly ArgIssue[] }

/** A verb cleared to run, with the args it will run with. */
export interface Prepared<Ctx, Run> {
  readonly ok: true
  readonly id: string
  readonly verb: Verb<Ctx, Run>
  readonly args: Readonly<Record<string, unknown>>
}

export type Invoked<Run> = { readonly ok: true; readonly id: string; readonly value: Run } | Refusal

export interface InvokeOptions {
  /** The tag of the context, as `project` takes it: a verb whose `on` excludes it is refused as `inapplicable`. */
  readonly on?: string
  /**
   * Whether a verb whose `enabled` returned `undefined` may run. By default it may: the projection
   * shows it undimmed, and the host's own authority decides downstream. Set this where a run must
   * wait for the authority to speak.
   */
  readonly refuseUnspoken?: boolean
  /**
   * The taste a refusal's `reason` is worded by, so a refusal reads as the surface did. It words,
   * and never decides: whether a verb runs is the same with or without it. Must have been applied
   * to this register.
   */
  readonly taste?: Attributed
}

/**
 * Everything between «a surface named this verb» and «run it», without running it: the id is
 * known, the verb applies here, it is not withheld, and the args fit. Pure — it reads the verb's
 * questions of `ctx` and returns data.
 */
export function prepare<Ctx, Run>(
  register: Register<Ctx, Run>,
  id: string,
  ctx: Ctx,
  args?: Readonly<Record<string, unknown>>,
  options: InvokeOptions = {},
): Prepared<Ctx, Run> | Refusal {
  const verb = register.get(id)
  if (!verb) return { ok: false, id, code: "unknown" }
  const taste = options.taste
  if (taste && !taste.has(id)) throw new Error(`verb "${id}" has no resolved taste — apply the taste to the register being invoked`)
  if (verb.on && options.on !== undefined && !verb.on.includes(options.on)) return { ok: false, id, code: "inapplicable" }
  const members = membersFor(register.vocabulary, ctx)
  const { enabled, cause } = verdictOf(verb as Verb<Ctx, unknown, never>, ctx, register.vocabulary, members)
  if (enabled === false) {
    if (!cause) return { ok: false, id, code: "withheld" }
    return { ok: false, id, code: "withheld", cause, reason: taste ? taste.reasonOf(cause) : sentence(cause) || cause }
  }
  if (enabled === undefined && options.refuseUnspoken) return { ok: false, id, code: "unspoken" }
  // The same types and members the projection stated, read with the same context.
  const domains: Record<string, Domains[string]> = {}
  for (const a of verb.args ?? []) {
    const m = typeof a.domain === "string" ? members(a.domain) : undefined
    if (m && typeof a.domain === "string") domains[a.domain] = m
  }
  const types = register.vocabulary.types
  const issues = checkArgs(verb.args, args, { ...(types ? { types } : {}), domains })
  if (issues.length) return { ok: false, id, code: "args", issues }
  return { ok: true, id, verb, args: args ?? {} }
}

/**
 * {@link prepare}, then `run`. The one place this library calls a verb's `run`, and only when
 * asked: what `run` returns — a command, a request, a promise — is handed back untouched as `value`.
 */
export function invoke<Ctx, Run>(
  register: Register<Ctx, Run>,
  id: string,
  ctx: Ctx,
  args?: Readonly<Record<string, unknown>>,
  options: InvokeOptions = {},
): Invoked<Run> {
  const p = prepare(register, id, ctx, args, options)
  if (!p.ok) return p
  const value = p.verb.args?.length ? p.verb.run(ctx, p.args) : p.verb.run(ctx)
  return { ok: true, id, value }
}
