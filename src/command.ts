/**
 * The outlet, in the platform's grammar. The Invoker Commands API lets a `<button command="…">`
 * fire a `CommandEvent` at the element it addresses, and reserves the `--` prefix for commands the
 * platform does not own — which is exactly a host's verb catalogue. This module is the whole bridge
 * between a verb id and that spelling; it names no DOM type, so it compiles where no DOM exists,
 * and a `CommandEvent` fits its structural argument.
 */
export const CUSTOM_PREFIX = "--"

/** `document:sign` → `--document:sign`: the `command` attribute a button carries to summon this verb. */
export function commandName(id: string): string {
  return CUSTOM_PREFIX + id
}

/**
 * The verb id a `command` names, or `null` when the command is the platform's own (`show-modal`,
 * `toggle-popover`) or empty. Accepts the string or anything carrying `command` — a `CommandEvent`.
 */
export function verbIdOf(command: string | { readonly command: string }): string | null {
  const c = typeof command === "string" ? command : command.command
  return c.startsWith(CUSTOM_PREFIX) && c.length > CUSTOM_PREFIX.length ? c.slice(CUSTOM_PREFIX.length) : null
}
