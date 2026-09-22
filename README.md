# verbr

A verb register for Command API frontends. Capabilities are declared once as data; taste is a document; every surface is a projection; the platform summons a verb with `<button command="--id">`.

verbr holds no state, touches no DOM, and knows no host. It is the joint between a host's state and a host's screens, generic over both. Its first hosts are Nodemirror and ProseMirror; its ancestors are three registers that were built separately and turned out to be one thing: `@sibar/verbs` in sibardoc-prototype, prosemirror-verbs, and Nodemirror's action catalogue.

## The verb

A **verb** is a declared capability: an id, what the host executes (`run`, opaque here), and four questions it answers of the host's context.

```ts
import type { Verb } from "verbr"

const sell: Verb<ItemCtx, Request> = {
  id: "sell",
  run: (ctx) => request("sell", { targets: [ctx.node.id] }),
  enabled: (ctx) => ctx.offered?.includes("sell"),   // true · false · undefined
  unavailable: () => "only the seller may accept",   // read only when enabled said false
}
const place: Verb<ItemCtx, Request> = {
  id: "place",
  run: (ctx, args) => request("place", { targets: [ctx.node.id], payload: args }),
  args: [{ name: "amount", type: "number" }],
}
```

**Availability has three values.** `true` is offered, `false` is withheld, and `undefined` means the authority has not spoken, so the verb abstains rather than guesses. The projection carries the third value as an absent key, the way a silent conclusion pours no attribute. A verb without `enabled` is always offered.

**Applicability is not availability.** `on` names the tags of the contexts a verb belongs to — a node type for one host, `"table"` for another; the host says what a tag means. Absent means everywhere. Where `enabled` speaks of this moment and owes a reason, `on` speaks of where the verb lives at all: `project(..., { on: "item" })` skips a verb tagged elsewhere, so it is *absent* from the projection, never withheld and never dimmed. VS Code draws the same line between a command's `when` clause and its `enablement`.

**Kind is deduced, never declared.** No arguments is an `action`, or a `toggle` if the verb reads back. One argument over a domain is a `choice`. One argument to type in is a `value`. Several arguments are an action that collects first. How a kind is *drawn* is the open `as` attribute, and that is taste.

Every key not in the capability set (`id`, `run`, `enabled`, `unavailable`, `read`, `appliesTo`, `args`, `on`) is taste or a host extension and is preserved, never refused. A REST host's `affects`, a `danger` flag, a `collector` name all ride along and reach the surface untouched. The one exception is a key that misspells a capability — `Enabled`, `enable`, `unavailble` — which is refused, because it would otherwise pass as taste and leave the capability silently undeclared.

**Partial selections.** `appliesTo` says how many of the context's targets a verb can touch; the projection shows «3 of 7» when that is some but not all. A verb that applies to none of them cannot run, so it is withheld like one whose `enabled` said `false`.

## Composition

```ts
import { compose } from "verbr"
const register = compose(documentVerbs, folderVerbs, [sell, place])
```

One act. A duplicate id throws at build, never at a click, and so do an empty id (no surface could summon it) and an `on` that is not a list of tags. Entries are plain data, so re-keying or stripping is a `map` before composing, not an API.

## Taste is a document

Everything a host decides about a verb that is not what it does: the word, the picture, the chord, the section, the drawing.

```yaml
verbs:
  place: { label: "Place bid", icon: gavel, section: bidding, keys: ["Mod-Enter"] }
  sell:  { label: "Accept leading bid", icon: check, section: closing }
layers:
  - name: values-dock
    where: { kind: value }
    attrs: { manner: docked }
  - name: closing-behind-menu
    where: { section: closing }
    attrs: { manner: menu }
sections:
  - { id: bidding, label: "Bidding" }
  - { id: closing, label: "Closing", as: menu }
```

`verbs` holds per-verb opinions keyed by id. `layers` holds rules that apply to many verbs at once, in order, later winning per key. A rule selects with a `where` of attribute equalities: `id` (exact or `prefix*`), `kind`, `argType`, or any attribute an earlier layer resolved, `null` matching absence (a value stated as `null` counts as absent). A layer sees the register as resolved so far, so judgements compose instead of being restated per verb. There is no specificity. Order is the only precedence.

A value is a literal or a **named derivation**, `{ derive: "humanize" }`, resolved by a function the host holds. That is the whole of computation allowed in a document: data as far as the vocabulary reaches, code referred to by name beyond it. A bench, a test, or an agent can read a host's taste without running the host.

Several documents stack root-first, the same shape at every depth: a house file, a product file, a language file.

```ts
import { applyTaste } from "verbr"
const taste = applyTaste(register, [house, product, italian])
taste.attrsOf("sell")             // the resolved bag
taste.describe("sell", "manner")  // every claim, in order, the winner marked
taste.audit()                     // every (verb, key) more than one layer claimed
taste.orphans()                   // taste that reached nothing: a verbs entry for an id not composed, a layer that selected no verb
```

A cascade owes sight, not refusal: taste that reached nothing is reported by `orphans`, not refused, because a house file may speak of verbs a given host never composed. What is refused, at build and loudly, is taste that could only mislead:

- a layer that reaches a capability key, or misspells one, because taste may rename a verb but never redefine what it does;
- a layer or a declaration that states a key the projection writes (`kind`, `pressed`, `value`, `reason`, `pending`, `shortcut`, and `items`, which marks a group), because a state nobody read is a lie on a surface;
- a `where` that selects on a capability or projected key, or names a kind that does not exist, because it could never match;
- a derivation the host does not hold, in a layer or in a declaration;
- a verb placed in a section no document declares, and a section whose `parent` is undeclared or loops back, because the projection could only drop it.

The naming default is itself a layer, seated first, matching only where no label exists, visible in `describe` and overridable by anything: `table:add-row-after` reads "Add row after" until someone says otherwise.

## The projection

```ts
import { project, flat } from "verbr"
const tree = project(register, ctx, taste, { on: "item", face: "icon", platform: "mac", includeUnavailable: false })
```

The register, seen from a surface, as plain JSON: sections with their members, each member a `Control` with `kind`, `as`, `label`, `icon`, the three-valued `enabled`, `reason`, `pending`, `pressed` or `value`, `appliesTo`, a formatted `shortcut`, `args`, and every other taste attribute carried through, `keys` included, so a surface can bind the chords it displays. No function anywhere, so `JSON.stringify(tree)` is already an agent's tool manifest. A toolbar, a palette, a menu and a test read the same object and cannot disagree about what is available.

`formatChord` draws a chord for a person: `Mod-Enter` is `⌘↵` on a Mac and `Ctrl+Enter` elsewhere. Parts split on `-` or `+`, the last part is always the key (`Mod--` is Mod with minus), modifier spellings are read in any case (`ctrl`, `Control`, `Option`, `Cmd`), and modifiers are drawn in the platform's order (⌃⌥⇧⌘ on a Mac).

A verb that does not apply (`on`) is not there at all. A group with no visible member is dropped. A taste applied to a different register is refused rather than projected unlabelled. Withheld verbs are dropped unless `includeUnavailable` asks for them with their reasons: a menu explains, a toolbar acts. `face: "icon"` is a strip's rule, no picture no control; `words` is the floor.

## The outlet

```ts
import { commandName, verbIdOf } from "verbr"
commandName("sell")                       // "--sell"
verbIdOf(event)                           // "sell", or null for the platform's own commands
```

The Invoker Commands API lets a `<button command="--sell">` fire a native `CommandEvent` at the element it addresses, and reserves the `--` prefix for words the platform does not own. The event fires at the invokee, does not bubble, and is not composed, so a host listens in the capture phase on `document` and keeps its invokees in the light DOM. A host that needs a payload uses a form; a host that needs many targets keeps its own event for that case.

## What it refuses

No DOM. No state. No subscription. No knowledge of a host's state type beyond a type parameter. No base class or controller for an author's element. The contract is the tool: an element receives a list of Controls and emits `command`.

## Provenance

The verb contract is `@sibar/verbs`' with three-valued availability and a type parameter for context. Composition, the cascade with sight, the face rule and the control tree are prosemirror-verbs'. The action catalogue as the source of kinds is Nodemirror's. The rule that a document holds data as far as a vocabulary reaches and names code beyond it is Nodemirror's Law and Cascata's freeze, applied to taste.

Findings from the first build, recorded so they are not rediscovered: the naming default needed `where: { label: null }` to be a floor rather than an override, and that is a rule with a selection, not an unconditional layer. Hiding what is unavailable was never taste; it is the projection's option. Of the two rules for `value` in the ancestors, the one that does not require a readback was kept, so a payload field with nothing to read back is still a field.
