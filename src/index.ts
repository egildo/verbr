// verbr — the core. The register, its taste, its projection and its invocation: pure functions
// over data, nothing else. Nothing here touches a DOM, holds state, or knows a host exists.
// Surfaces beyond the projection live at subpaths: `verbr/chord` (the keyboard), `verbr/tools`
// (an agent's tool manifest), `verbr/outlet` (the Invoker Commands API's `--` spelling).

export { kindOf, isKind, domainOf, CAPABILITY_KEYS, PROJECTED_KEYS } from "./verb.ts"
export type { Verb, VerbArg, DomainMember, Kind } from "./verb.ts"

export { compose } from "./register.ts"
export type { Register } from "./register.ts"

export { applyTaste, humanize, NAMING } from "./taste.ts"
export type { Taste, Attrs, Layer, Where, Derivation, Derivations, Section, Claim, Attributed, Orphan } from "./taste.ts"

export { project, flat, isGroup } from "./project.ts"
export type { Control, ArgView, Group, TreeItem, Face, ProjectOptions } from "./project.ts"
export type { Platform } from "./chord.ts"

export { prepare, invoke } from "./invoke.ts"
export type { Prepared, Invoked, Refusal, InvokeOptions } from "./invoke.ts"

export { checkArgs, argSchema, argsSchema, ARG_TYPES } from "./args.ts"
export type { ArgType, ArgTypes, ArgIssue, ArgOptions, Domains, JsonSchema } from "./args.ts"
