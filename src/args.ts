import type { DomainMember, VerbArg } from "./verb.ts"

/**
 * What an argument's `type` means: a check a value must pass before `run`, and the JSON Schema a
 * tool manifest shows an agent. The vocabulary is open — a host adds its own types by name, the way
 * it adds derivations — and a type nobody defined accepts any value and states no schema.
 */
export interface ArgType {
  readonly check: (value: unknown) => boolean
  readonly schema: JsonSchema
}

/** A JSON Schema fragment, as plain data. */
export type JsonSchema = Readonly<Record<string, unknown>>

export type ArgTypes = Readonly<Record<string, ArgType>>

/** The members of a named domain, when the host can say them: `{ people: [{ value: "ada" }, …] }`. */
export type Domains = Readonly<Record<string, readonly DomainMember[]>>

const isString = (v: unknown): v is string => typeof v === "string"

/** The built-in types. A host's `types` of the same name replace them. */
export const ARG_TYPES: ArgTypes = {
  text: { check: isString, schema: { type: "string" } },
  string: { check: isString, schema: { type: "string" } },
  number: { check: (v) => typeof v === "number" && Number.isFinite(v), schema: { type: "number" } },
  integer: { check: (v) => Number.isInteger(v), schema: { type: "integer" } },
  boolean: { check: (v) => typeof v === "boolean", schema: { type: "boolean" } },
  date: { check: (v) => isString(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), schema: { type: "string", format: "date" } },
  datetime: { check: (v) => isString(v) && /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v)), schema: { type: "string", format: "date-time" } },
  url: { check: (v) => isString(v) && /^[a-z][a-z0-9+.-]*:\S+$/i.test(v), schema: { type: "string", format: "uri" } },
  email: { check: (v) => isString(v) && /^[^\s@]+@[^\s@]+$/.test(v), schema: { type: "string", format: "email" } },
}

export interface ArgOptions {
  /** Types beyond (or replacing) {@link ARG_TYPES}. */
  readonly types?: ArgTypes
  /** Members of named domains. A named domain the host does not list here is not checked. */
  readonly domains?: Domains
}

/** One thing wrong with the args a surface sent. Plain data, so an agent can read why it was refused. */
export interface ArgIssue {
  readonly arg: string
  readonly problem: "missing" | "undeclared" | "type" | "domain"
  /** For `type`, the type name; for `domain`, the accepted values (or the domain's name). */
  readonly expected?: string | readonly string[]
}

function typeOf(name: string | undefined, o: ArgOptions): ArgType | undefined {
  if (name === undefined) return undefined
  if (o.types && Object.hasOwn(o.types, name)) return o.types[name]
  return Object.hasOwn(ARG_TYPES, name) ? ARG_TYPES[name] : undefined
}

function membersOf(arg: VerbArg, o: ArgOptions): readonly DomainMember[] | undefined {
  if (arg.domain === undefined) return undefined
  if (typeof arg.domain !== "string") return arg.domain
  return o.domains && Object.hasOwn(o.domains, arg.domain) ? o.domains[arg.domain] : undefined
}

/**
 * Check the args a surface sent against a verb's declaration. No coercion: a surface that collected
 * `"42"` for a number converts it before sending. An arg is required only when it says so; a key
 * the verb does not declare is refused, so a typo never runs as silence.
 */
export function checkArgs(declared: readonly VerbArg[] | undefined, values: Readonly<Record<string, unknown>> = {}, o: ArgOptions = {}): readonly ArgIssue[] {
  const issues: ArgIssue[] = []
  const names = new Set((declared ?? []).map((a) => a.name))
  for (const key of Object.keys(values)) if (!names.has(key)) issues.push({ arg: key, problem: "undeclared" })
  for (const arg of declared ?? []) {
    const value = Object.hasOwn(values, arg.name) ? values[arg.name] : undefined
    if (value === undefined) {
      if (arg.required) issues.push({ arg: arg.name, problem: "missing" })
      continue
    }
    const members = membersOf(arg, o)
    if (members) {
      if (!members.some((m) => m.value === value)) issues.push({ arg: arg.name, problem: "domain", expected: members.map((m) => m.value) })
      continue
    }
    const type = typeOf(arg.type, o)
    if (type && !type.check(value)) issues.push({ arg: arg.name, problem: "type", expected: arg.type! })
  }
  return issues
}

/** One argument as JSON Schema: its type's schema, or an `enum` for a domain, with `title` and `description` from its taste. */
export function argSchema(arg: VerbArg, o: ArgOptions = {}): JsonSchema {
  const members = membersOf(arg, o)
  const base: Record<string, unknown> = members
    ? { type: "string", enum: members.map((m) => m.value) }
    : { ...typeOf(arg.type, o)?.schema }
  if (typeof arg["label"] === "string") base["title"] = arg["label"]
  if (typeof arg["description"] === "string") base["description"] = arg["description"]
  else if (typeof arg.domain === "string" && !members) base["description"] = `A member of the host's "${arg.domain}" domain.`
  return base
}

/** A verb's args as one JSON Schema object — what a tool manifest or a form generator reads. */
export function argsSchema(args: readonly VerbArg[] | undefined, o: ArgOptions = {}): JsonSchema {
  return objectSchema(args ?? [], (a) => argSchema(a, o))
}

/** The object schema around args whose own schemas are already known — a projection's, say. */
export function objectSchema<A extends { readonly name: string; readonly required?: boolean }>(list: readonly A[], schemaOf: (arg: A) => JsonSchema): JsonSchema {
  const required = list.filter((a) => a.required).map((a) => a.name)
  return {
    type: "object",
    properties: Object.fromEntries(list.map((a) => [a.name, schemaOf(a)])),
    ...(required.length ? { required } : {}),
    additionalProperties: false,
  }
}
