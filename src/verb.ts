/**
 * The verb — a **declared capability**: what a host can do, said once as data, addressable by id.
 *
 * A verb knows nothing about a surface, a store, a router or a DOM. It knows its host's `Ctx`
 * (an editor state, a node with its spoken answers, a selection) and answers four questions of it:
 * *may I run here* (`enabled`), *what do I read back* (`read`), *why not* (`unavailable`), and
 * *what do I need first* (`args`). `run` yields whatever the host executes — a ProseMirror command,
 * a Nodemirror request, a promise of an HTTP result — and this library never calls it.
 *
 * Every key not named below is **taste or a host extension** and is preserved, never refused: a
 * `danger` flag, a `collector` name, an `affects` list a REST host invalidates by. The capability
 * keys ({@link CAPABILITY_KEYS}) are the only ones a taste layer may not touch.
 */
export interface Verb<Ctx = unknown, Run = unknown, Args = Readonly<Record<string, unknown>>> {
  /** Unique across a composition — a collision is refused at build. `domain:local` by convention. */
  readonly id: string
  /**
   * What the host executes. Opaque here: a token, a function, a promise — the host's business.
   * Declared as a method so a verb typed with its own `Args` still composes into a register, where
   * args arrive from a surface as an untyped bag.
   */
  run(ctx: Ctx, args?: Args): Run
  /**
   * May it run, here, now? Three answers, not two: `true` (offered), `false` (withheld), and
   * `undefined` — **the authority has not spoken**, so the verb abstains rather than guesses. A
   * verb without `enabled` is always offered. The projection carries all three: an unspoken verb
   * reaches a surface with its `enabled` key absent, the way a silent conclusion pours no attribute.
   */
  readonly enabled?: (ctx: Ctx) => boolean | undefined
  /** Why not — consulted only when `enabled` said `false`. A reason for something you *can* do is a lie waiting to be read. */
  readonly unavailable?: (ctx: Ctx) => string | undefined
  /** The readback, if the verb addresses state: a boolean for a toggle, a member for a choice, a value for a field. */
  readonly read?: (ctx: Ctx) => unknown
  /** Over a multiple selection, how many targets this verb can touch — the «3 of 7». */
  readonly appliesTo?: (ctx: Ctx) => number
  /** What must be collected before `run` — present exactly when `run` needs `args`. */
  readonly args?: readonly VerbArg[]
  /**
   * The tags of the contexts this verb belongs to — a node type for one host, `"table"` for
   * another; the host says what a tag means. Absent means everywhere. This is **applicability, not
   * availability**: a verb that does not apply is absent from a projection, never «withheld». Where
   * `enabled` speaks of this moment and may be explained, `on` speaks of where the verb lives at all.
   */
  readonly on?: readonly string[]
  /** Taste or a host extension. Preserved, never refused. */
  readonly [extra: string]: unknown
}

/** One member of an enumerable domain. The `value` is capability; a label, an icon, a chord are taste and ride in the bag. */
export interface DomainMember {
  readonly value: string
  readonly [extra: string]: unknown
}

/**
 * What a collector must ask for. `type` is an open vocabulary (`text`, `number`, `date`, `url`);
 * `domain` is either the **name** of a vocabulary the host resolves (`"people"`) or the members
 * inline — the first keeps the declaration JSON-shaped when the members are data the host owns.
 */
export interface VerbArg {
  readonly name: string
  readonly type?: string
  readonly domain?: string | readonly DomainMember[]
  readonly required?: boolean
  /** A label is taste; a declarer who insists may carry one here, and the cascade may override it. */
  readonly [extra: string]: unknown
}

/**
 * The keys a capability owns. Everything else on a verb is taste, which is what lets a taste
 * layer be refused for reaching past its share: taste may rename a verb, never redefine what it does.
 */
export const CAPABILITY_KEYS: ReadonlySet<string> = new Set(["id", "run", "enabled", "unavailable", "read", "appliesTo", "args", "on"])

/**
 * The keys the projection writes on a `Control` from the host's context, and `items`, which marks a
 * `Group`. Neither taste nor a declaration's extras may carry them: a `pressed` or a `reason` nobody
 * read would be a lie on a surface, and a control carrying `items` would be taken for a group.
 */
export const PROJECTED_KEYS: ReadonlySet<string> = new Set(["kind", "pressed", "value", "reason", "pending", "shortcut", "items"])

const KINDS: ReadonlySet<string> = new Set(["action", "toggle", "choice", "value"])

/** `true` for one of the four {@link Kind}s. */
export function isKind(v: unknown): v is Kind {
  return typeof v === "string" && KINDS.has(v)
}

function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = row
  }
  return prev[b.length]!
}

/**
 * The capability key an extra key is probably a misspelling of — the same word in another case, or
 * within two edits of a long one (`enable`, `unavailble`, `appliesto`). An open bag accepts any key,
 * so a typo'd capability would otherwise pass as taste and reach a surface as an inert attribute.
 */
export function nearCapabilityKey(key: string): string | undefined {
  if (CAPABILITY_KEYS.has(key)) return undefined
  for (const cap of CAPABILITY_KEYS) {
    if (key.toLowerCase() === cap.toLowerCase()) return cap
    if (cap.length >= 7 && distance(key, cap) <= 2) return cap
  }
  return undefined
}

/**
 * What a verb **is**, deduced from its declaration and never written by a host: an `action` (a
 * doing), a `toggle` (a doing that is also a state — an action plus a readback), a `choice` (one
 * argument over a domain), a `value` (one argument to type in). Several arguments are an `action`
 * that collects first. Closed, because behaviour follows from it; how it is *drawn* is the open
 * `as` attribute, which is taste.
 */
export type Kind = "action" | "toggle" | "choice" | "value"

/** Deduce a verb's {@link Kind} from its shape. */
export function kindOf(verb: Verb<never, unknown, never>): Kind {
  const args = verb.args ?? []
  if (args.length === 0) return verb.read ? "toggle" : "action"
  const only = args.length === 1 ? args[0] : undefined
  if (only?.domain !== undefined) return "choice"
  if (only) return "value"
  return "action"
}

/** The namespace before the first `:` — `document:sign` → `document`; an id without one belongs to `""`. */
export function domainOf(id: string): string {
  const i = id.indexOf(":")
  return i < 0 ? "" : id.slice(0, i)
}
