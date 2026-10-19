import { formatChord, type Platform } from "./chord.ts"
import { argSchema, type JsonSchema } from "./args.ts"
import { membersFor, verdictOf, type Members, type Register, type Vocabulary } from "./register.ts"
import { humanize, type Attributed, type Section } from "./taste.ts"
import { kindOf, type Kind, type Verb, type VerbArg } from "./verb.ts"

/**
 * What a surface eats: one verb, seen from the outside, as **plain JSON**. No function, no DOM
 * type, an `icon` that is a name. A component receives a list of these and emits an invocation
 * by id; it never imports the register. Because it is JSON-shaped, the same object serialized is
 * already an agent's tool manifest.
 *
 * `enabled` has three states and the third is **absence**: offered (`true`), withheld (`false`),
 * and not yet spoken (no key) — the authority abstained, and so does the view. A surface styles
 * silence; it never invents a zero.
 */
export interface Control {
  readonly id: string
  /** What it is — deduced, closed. */
  readonly kind: Kind
  /** How to draw it — the default for its kind unless taste said otherwise. Open; a surface that does not know the word falls back to the kind's default. */
  readonly as: string
  /** The words: what a plain rendering draws and what a screen reader says. Always present — the naming layer sees to it. */
  readonly label: string
  readonly icon?: string
  readonly enabled?: boolean
  /** Why not, as a name: the rule a guard found false, or what `unavailable` named. Stable — what a test or an agent keys on. Present only when `enabled` is `false`. */
  readonly cause?: string
  /** Why not, in words: the {@link cause} as taste words it, humanized when nobody did. Present exactly when `cause` is. */
  readonly reason?: string
  /** A run of this verb is in flight. Owned by whoever runs it, never by the register. */
  readonly pending?: boolean
  /** A toggle's state. */
  readonly pressed?: boolean
  /** A value's or a choice's current reading. */
  readonly value?: unknown
  /** «3 of 7» — only when a selection is partial. A verb that applies to none of it is withheld. */
  readonly appliesTo?: { readonly n: number; readonly of: number }
  /** The first chord, formatted for the platform asked. The chords themselves ride along as the `keys` attribute. */
  readonly shortcut?: string
  readonly args?: readonly ArgView[]
  /** The section this verb sits in, when taste placed it. */
  readonly section?: string
  /** Every other resolved taste attribute, carried through untouched. */
  readonly [attr: string]: unknown
}

/**
 * An argument, projected. `domain` is as declared: inline members, or a name. A named domain's
 * `members` are read from the context, absent when the host cannot say yet. `schema` is the
 * argument as JSON Schema — its type's, or an `enum` of its members — the same the args are
 * checked against at `invoke`, so a form or an agent is never promised what the door refuses.
 */
export interface ArgView {
  readonly name: string
  readonly type?: string
  readonly domain?: string | readonly { readonly value: string; readonly [extra: string]: unknown }[]
  readonly members?: readonly { readonly value: string; readonly [extra: string]: unknown }[]
  readonly required?: boolean
  readonly schema: JsonSchema
  readonly [extra: string]: unknown
}

/** A section with its members, nested. `as` and every other attribute are the section's taste, carried through. */
export interface Group {
  readonly id: string
  readonly items: readonly TreeItem[]
  readonly [attr: string]: unknown
}

export type TreeItem = Control | Group

/** `true` for a {@link Group}. */
export function isGroup(item: TreeItem): item is Group {
  return "items" in item
}

/**
 * What counts as a face, and so what a verb needs to appear at all. `words`, the default and
 * every verb's floor, since every verb has a label. `icon` is a strip's rule: a doing needs a
 * picture, so an action or a toggle without one is not there — curation by omission, chosen by
 * the surface. A `choice` and a `value` are exempt: they wear the member they are on and the
 * field they are, as a font box or a zoom field does in any toolbar.
 */
export type Face = "words" | "icon"

export interface ProjectOptions {
  readonly face?: Face
  /** The tag of the context being projected. A verb whose `on` is set and does not include it is skipped — it does not apply here, so it is absent, not withheld. */
  readonly on?: string
  /** Show withheld verbs, disabled, instead of dropping them. A menu explains; a toolbar acts. */
  readonly includeUnavailable?: boolean
  /** Verb ids currently mid-flight. */
  readonly pending?: ReadonlySet<string>
  readonly platform?: Platform
}

const DEFAULT_AS: Readonly<Record<Kind, string>> = { action: "button", toggle: "button", choice: "select", value: "field" }

function argView(arg: VerbArg, vocabulary: Vocabulary<never>, members: Members): ArgView {
  const resolved = typeof arg.domain === "string" ? members(arg.domain) : undefined
  const domains = resolved && typeof arg.domain === "string" ? { domains: { [arg.domain]: resolved } } : {}
  return { ...arg, ...(resolved ? { members: resolved } : {}), schema: argSchema(arg, { ...(vocabulary.types ? { types: vocabulary.types } : {}), ...domains }) }
}

function toControl<Ctx, Run>(verb: Verb<Ctx, Run>, ctx: Ctx, register: Register<Ctx, Run>, members: Members, taste: Attributed, o: ProjectOptions): Control | null {
  if (!taste.has(verb.id)) throw new Error(`verb "${verb.id}" has no resolved taste — apply the taste to the register being projected`)
  if (verb.on && o.on !== undefined && !verb.on.includes(o.on)) return null

  const attrs = taste.attrsOf(verb.id)
  const kind = kindOf(verb as Verb<never, unknown, never>)
  const icon = typeof attrs["icon"] === "string" ? attrs["icon"] : undefined
  if ((o.face ?? "words") === "icon" && !icon && (kind === "action" || kind === "toggle")) return null

  const verdict = verdictOf(verb as Verb<Ctx, unknown, never>, ctx, register.vocabulary, members)
  const { enabled, cause, appliesTo: applies } = verdict
  if (enabled === false && !o.includeUnavailable) return null
  const read = verb.read?.(ctx)
  const keys = attrs["keys"]
  const first = Array.isArray(keys) ? keys[0] : typeof keys === "string" ? keys : undefined

  const { label: _l, icon: _i, as: _a, section: _s, ...rest } = attrs
  return {
    ...rest,
    id: verb.id,
    kind,
    as: typeof attrs["as"] === "string" ? attrs["as"] : DEFAULT_AS[kind],
    label: attrs["label"] == null ? humanize(verb.id) : String(attrs["label"]),
    ...(icon ? { icon } : {}),
    ...(enabled !== undefined ? { enabled } : {}),
    ...(cause ? { cause, reason: taste.reasonOf(cause) } : {}),
    ...(o.pending?.has(verb.id) ? { pending: true } : {}),
    ...(kind === "toggle" && read !== undefined ? { pressed: Boolean(read) } : {}),
    ...(kind !== "toggle" && read !== undefined ? { value: read } : {}),
    ...(applies && applies.of > 1 && applies.n < applies.of ? { appliesTo: { n: applies.n, of: applies.of } } : {}),
    ...(typeof first === "string" ? { shortcut: formatChord(first, o.platform) } : {}),
    ...(verb.args?.length ? { args: verb.args.map((a) => argView(a, register.vocabulary as Vocabulary<never>, members)) } : {}),
    ...(typeof attrs["section"] === "string" ? { section: attrs["section"] } : {}),
  }
}

/**
 * The register, seen from a surface: every verb the context admits, as {@link Control}s, laid into
 * the taste's sections. A group with no visible member is dropped, not rendered empty — the
 * headings are part of the projection, not of the chrome. Verbs no section claims trail the sections at their level.
 * Pure: `(register, ctx, taste, options)` in, JSON out, nothing else touched. Throws when the taste
 * was applied to a register that does not hold every verb projected.
 */
export function project<Ctx, Run>(
  register: Register<Ctx, Run>,
  ctx: Ctx,
  taste: Attributed,
  options: ProjectOptions = {},
): readonly TreeItem[] {
  const views: Control[] = []
  const members = membersFor(register.vocabulary, ctx)
  for (const verb of register.verbs) {
    const v = toControl(verb, ctx, register, members, taste, options)
    if (v) views.push(v)
  }
  const bySection = new Map<string | undefined, Control[]>()
  for (const v of views) bySection.set(v.section, [...(bySection.get(v.section) ?? []), v])

  const build = (parent: string | undefined): TreeItem[] => {
    const own = bySection.get(parent) ?? []
    const groups = taste.sections
      .filter((s: Section) => s.parent === parent)
      .map((s: Section): Group | null => {
        const items = build(s.id)
        if (items.length === 0) return null
        const { id: _id, parent: _p, ...attrs } = s
        return { ...attrs, id: s.id, items }
      })
      .filter((g): g is Group => g !== null)
    // Sections first, in the taste's order; verbs no section claimed trail them, unplaced.
    return [...groups, ...own]
  }
  return build(undefined)
}

/** The flat list, for a surface with no sections. */
export function flat(tree: readonly TreeItem[]): readonly Control[] {
  return tree.flatMap((item) => (isGroup(item) ? flat(item.items) : [item]))
}
