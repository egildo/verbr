// verbr — public surface. The register and its pure projections, nothing else. Nothing here
// touches a DOM, holds state, or knows a host exists.

export { kindOf, isKind, domainOf, CAPABILITY_KEYS, PROJECTED_KEYS } from "./verb.ts"
export type { Verb, VerbArg, DomainMember, Kind } from "./verb.ts"

export { compose } from "./register.ts"
export type { Register } from "./register.ts"

export { applyTaste, humanize, NAMING } from "./taste.ts"
export type { Taste, Attrs, Layer, Where, Derivation, Derivations, Section, Claim, Attributed, Orphan } from "./taste.ts"

export { project, flat, isGroup } from "./project.ts"
export type { Control, ArgView, Group, TreeItem, Face, ProjectOptions } from "./project.ts"

export { formatChord } from "./chord.ts"
export type { Platform } from "./chord.ts"

export { commandName, verbIdOf, CUSTOM_PREFIX } from "./command.ts"
