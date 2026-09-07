import { formatChord, type Platform } from "./chord.ts"
import type { Register } from "./register.ts"
import type { Attributed, Section } from "./taste.ts"
import { kindOf, type Kind, type Verb } from "./verb.ts"

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
  /** Why not — present only when `enabled` is `false` and the verb offered a reason. */
  readonly reason?: string
  /** A run of this verb is in flight. Owned by whoever runs it, never by the register. */
  readonly pending?: boolean
  /** A toggle's state. */
  readonly pressed?: boolean
  /** A value's or a choice's current reading. */
  readonly value?: unknown
  /** «3 of 7» — only when a selection is partial. */
  readonly appliesTo?: { readonly n: number; readonly of: number }
  /** The first chord, formatted for the platform asked. */
  readonly shortcut?: string
  readonly args?: readonly ArgView[]
  /** The section this verb sits in, when taste placed it. */
  readonly section?: string
  /** Every other resolved taste attribute, carried through untouched. */
  readonly [attr: string]: unknown
}

/** An argument, projected: a `domain` given inline keeps its members; a named one keeps its name — the host resolves it. */
export interface ArgView {
  readonly name: string
  readonly type?: string
  readonly domain?: string | readonly { readonly value: string; readonly [extra: string]: unknown }[]
  readonly required?: boolean
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
 * every verb's floor, since every verb has a label. `icon` is a strip's rule: no picture, no
 * control — curation by omission, chosen by the surface.
 */
export type Face = "words" | "icon"

export interface ProjectOptions {
  readonly face?: Face
  /** Show withheld verbs, disabled, instead of dropping them. A menu explains; a toolbar acts. */
  readonly includeUnavailable?: boolean
  /** Verb ids currently mid-flight. */
  readonly pending?: ReadonlySet<string>
  readonly platform?: Platform
  /** How many targets the context holds, for «n of N». */
  readonly of?: number
}

const DEFAULT_AS: Readonly<Record<Kind, string>> = { action: "button", toggle: "button", choice: "select", value: "field" }

function toView<Ctx, Run>(verb: Verb<Ctx, Run>, ctx: Ctx, taste: Attributed, o: ProjectOptions): Control | null {
  const attrs = taste.attrsOf(verb.id)
  const kind = kindOf(verb as Verb<never, unknown, never>)
  const icon = typeof attrs["icon"] === "string" ? attrs["icon"] : undefined
  if ((o.face ?? "words") === "icon" && !icon) return null

  const enabled = verb.enabled ? verb.enabled(ctx) : true
  if (enabled === false && !o.includeUnavailable) return null
  const reason = enabled === false ? verb.unavailable?.(ctx) : undefined
  const read = verb.read?.(ctx)
  const n = verb.appliesTo?.(ctx)
  const keys = attrs["keys"]
  const first = Array.isArray(keys) ? keys[0] : typeof keys === "string" ? keys : undefined

  const { label: _l, icon: _i, as: _a, keys: _k, section: _s, ...rest } = attrs
  return {
    ...rest,
    id: verb.id,
    kind,
    as: typeof attrs["as"] === "string" ? attrs["as"] : DEFAULT_AS[kind],
    label: String(attrs["label"] ?? verb.id),
    ...(icon ? { icon } : {}),
    ...(enabled !== undefined ? { enabled } : {}),
    ...(reason ? { reason } : {}),
    ...(o.pending?.has(verb.id) ? { pending: true } : {}),
    ...(kind === "toggle" && read !== undefined ? { pressed: Boolean(read) } : {}),
    ...(kind !== "toggle" && read !== undefined ? { value: read } : {}),
    ...(n !== undefined && o.of !== undefined && o.of > 1 && n < o.of ? { appliesTo: { n, of: o.of } } : {}),
    ...(typeof first === "string" ? { shortcut: formatChord(first, o.platform) } : {}),
    ...(verb.args?.length ? { args: verb.args.map((a) => ({ ...a })) } : {}),
    ...(typeof attrs["section"] === "string" ? { section: attrs["section"] } : {}),
  }
}

/**
 * The register, seen from a surface: every verb the context admits, as {@link Control}s, laid into
 * the taste's sections. A group with no visible member is dropped, not rendered empty — the
 * headings are part of the projection, not of the chrome. Verbs no section claims trail the sections at their level.
 * Pure: `(register, ctx, taste, options)` in, JSON out, nothing else touched.
 */
export function project<Ctx, Run>(
  register: Register<Ctx, Run>,
  ctx: Ctx,
  taste: Attributed,
  options: ProjectOptions = {},
): readonly TreeItem[] {
  const views: Control[] = []
  for (const verb of register.verbs) {
    const v = toView(verb, ctx, taste, options)
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
