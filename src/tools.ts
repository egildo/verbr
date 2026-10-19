import { objectSchema, type JsonSchema } from "./args.ts"
import { flat, type Control, type TreeItem } from "./project.ts"

/**
 * A verb as an agent's tool, in the shape the Model Context Protocol gives a tool: `name`, `title`,
 * `description`, `inputSchema`. Other providers differ only in spelling — `input_schema` for one,
 * `parameters` for another — which is a `map` at the host, not a second API.
 */
export interface Tool {
  readonly name: string
  readonly title: string
  readonly description: string
  readonly inputSchema: JsonSchema
}

export interface Manifest {
  readonly tools: readonly Tool[]
  /** The verb id a tool name stands for — the way back from an agent's call to `invoke`. */
  idOf(name: string): string | undefined
}

export interface ManifestOptions {
  /** Offer withheld verbs as tools too. By default an agent is offered what a user could press. */
  readonly includeUnavailable?: boolean
}

/**
 * A tool name from a verb id. Tool names are commonly held to `[A-Za-z0-9_-]{1,64}`, and verb ids
 * are namespaced with `:`, so every other character becomes `_`; a clash after that is numbered.
 */
function toolName(id: string, taken: { has(name: string): boolean }): string {
  const base = id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64) || "verb"
  if (!taken.has(base)) return base
  for (let i = 2; ; i++) {
    const suffix = `_${i}`
    const candidate = base.slice(0, 64 - suffix.length) + suffix
    if (!taken.has(candidate)) return candidate
  }
}

/**
 * The projection as a tool manifest. It reads {@link Control}s — so an agent is offered exactly
 * what a surface would show, in the same words — and states each one's args as JSON Schema. The
 * description is the control's `description` attribute when taste gave one, else its label.
 */
export function manifest(tree: readonly TreeItem[] | readonly Control[], options: ManifestOptions = {}): Manifest {
  const tools: Tool[] = []
  const ids = new Map<string, string>()
  for (const control of flat(tree as readonly TreeItem[])) {
    if (control.enabled === false && !options.includeUnavailable) continue
    const name = toolName(control.id, ids)
    ids.set(name, control.id)
    const description = typeof control["description"] === "string" ? control["description"] : control.label
    tools.push({ name, title: control.label, description, inputSchema: objectSchema(control.args ?? [], (a) => a.schema) })
  }
  return { tools, idOf: (name) => ids.get(name) }
}
