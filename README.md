# verbr

A command register for any UI, over any state. Declare what the user can do once, as data; every surface — a toolbar, a menu, a command palette, the keyboard, an AI agent — is a projection of that one register, and every one of them runs a command through the same funnel.

verbr holds no state, touches no DOM, and knows no framework. It sits between your state (Redux, Zustand, signals, XState, an editor's state, a plain object — whatever you hand it as the context) and your screens, and it is generic over both.

## Why

Most apps grow the same question five times: *what can the user do right now, and why not?* The toolbar answers it one way, the context menu another, the palette a third, the keyboard handler a fourth, and the agent integration a fifth. Sooner or later they disagree — a greyed-out button whose shortcut still fires, a menu item an agent cannot see.

verbr answers it once. A **verb** declares a capability and the questions it answers of your state. A **taste** document says how verbs look: their words, icons, chords, sections. A **projection** turns register, state and taste into plain JSON a surface renders. **`invoke`** is the one door every surface calls through, so the keyboard cannot run what the button refuses.

## A walkthrough

A to-do list, with a store that dispatches actions. The store could be anything; verbr only ever sees the state you pass in and hands back what `run` returns.

```ts
import { compose, applyTaste, project, flat, invoke, type Verb } from "verbr"

const todoVerbs: Verb<State, Action>[] = [
  {
    id: "todo:add",
    run: (_s, args) => ({ type: "add", title: args?.["title"] }),
    args: [{ name: "title", type: "text", required: true }],
  },
  {
    id: "todo:complete",
    run: (s) => ({ type: "complete", ids: s.selected }),
    appliesTo: (s) => s.todos.filter((t) => s.selected.includes(t.id) && !t.done).length,
    unavailable: () => "select an open to-do",
  },
  {
    id: "todo:clear-done",
    run: () => ({ type: "clearDone" }),
    enabled: (s) => s.todos.some((t) => t.done),
    unavailable: () => "nothing is done yet",
  },
  {
    id: "view:filter",
    run: (_s, args) => ({ type: "filter", show: args?.["show"] }),
    read: (s) => s.filter,
    args: [{ name: "show", domain: [{ value: "all" }, { value: "open" }, { value: "done" }] }],
  },
]

const register = compose(todoVerbs)
const taste = applyTaste(register, {
  verbs: {
    "todo:add": { icon: "plus", keys: "Mod-Enter", section: "edit" },
    "todo:complete": { icon: "check", keys: ["Mod-d"], section: "edit" },
    "todo:clear-done": { label: "Clear completed", section: "edit" },
    "view:filter": { label: "Show", section: "view" },
  },
  sections: [{ id: "edit", label: "Edit" }, { id: "view", label: "View" }],
})
```

Surfaces are projections. A toolbar wants icons and only what can run; a palette wants words, shortcuts, and what cannot run with the reason why:

```ts
const state = store.getState()
const toolbar = project(register, state, taste, { face: "icon", of: state.selected.length })
const palette = flat(project(register, state, taste, { includeUnavailable: true, platform: "mac" }))
// palette[0] → { id: "todo:add", kind: "value", as: "field", label: "Add", icon: "plus", enabled: true, shortcut: "⌘↵", section: "edit", … }
```

Every surface runs through one funnel:

```ts
function run(id: string, args?: Record<string, unknown>) {
  const result = invoke(register, id, store.getState(), args)
  if (result.ok) store.dispatch(result.value)
  return result // or { ok: false, code: "withheld", reason: "select an open to-do" }, { code: "args", issues: [...] }, …
}
```

The keyboard, the platform's `<button command>`, and an agent all end in `run`:

```ts
import { keymap } from "verbr/chord"
import { verbIdOf } from "verbr/outlet"
import { manifest } from "verbr/tools"

const keys = keymap(register, taste, { platform: "mac" })
addEventListener("keydown", (e) => { const id = keys.lookup(e); if (id) { e.preventDefault(); run(id) } })

document.addEventListener("command", (e) => { const id = verbIdOf(e); if (id) run(id) }, { capture: true })

const tools = manifest(project(register, store.getState(), taste))
// tools.tools → [{ name: "todo_add", title: "Add", description: "Add", inputSchema: { type: "object", … } }, …]
// on a tool call: run(tools.idOf(call.name)!, call.input)
```

And staying current is re-projecting when the state changes — the projection is a pure function, so it belongs wherever your state library derives values (a selector, a `computed`, a subscription):

```ts
store.subscribe(() => render(project(register, store.getState(), taste, { face: "icon" })))
```

This walkthrough runs as a test in [`src/readme.test.ts`](src/readme.test.ts).

## The verb

A **verb** is a declared capability: an id, what the host executes (`run`, opaque to verbr), and the questions it answers of the host's context — *may I run* (`enabled`), *why not* (`unavailable`), *what do I read back* (`read`), *how many targets can I touch* (`appliesTo`), *what must be collected first* (`args`), and *where do I live* (`on`).

**Availability has three values.** `true` is offered, `false` is withheld, and `undefined` means the authority has not spoken — a permission still loading, a server that has not answered — so the verb abstains rather than guesses. The projection carries the third value as an absent `enabled` key; a surface styles the silence, it never invents a zero. A verb without `enabled` is always offered.

**Applicability is not availability.** `on` names the tags of the contexts a verb belongs to — `"table"`, `"image"`, `"row"`; the host says what a tag means. Absent means everywhere. Where `enabled` speaks of this moment and owes a reason, `on` speaks of where the verb lives at all: `project(..., { on: "row" })` skips a verb tagged elsewhere, so it is *absent*, never withheld and never dimmed. VS Code draws the same line between a command's `when` clause and its `enablement`.

**Kind is deduced, never declared.** No arguments is an `action`, or a `toggle` if the verb reads back. One argument over a domain is a `choice`. One argument to type in is a `value`. Several arguments are an action that collects first. How a kind is *drawn* is the open `as` attribute, and that is taste.

**Partial selections.** `appliesTo` says how many of the context's targets a verb can touch; the projection shows «3 of 7» when that is some but not all. A verb that applies to none of them cannot run, so it is withheld like one whose `enabled` said `false`.

Every key not in the capability set (`id`, `run`, `enabled`, `unavailable`, `read`, `appliesTo`, `args`, `on`) is taste or a host extension and is preserved, never refused. A REST host's `affects`, a `danger` flag, a `collector` name all ride along and reach the surface untouched. The one exception is a key that misspells a capability — `Enabled`, `enable`, `unavailble` — which is refused, because it would otherwise pass as taste and leave the capability silently undeclared.

## Composition

```ts
const register = compose(documentVerbs, folderVerbs, [share, archive])
```

One act. A duplicate id throws at build, never at a click, and so do an empty id (no surface could summon it) and an `on` that is not a list of tags. Entries are plain data, so re-keying or stripping is a `map` before composing, not an API. A verb typed with its own `Args` composes like any other; in the register, args are what a surface sends, and `invoke` checks them.

## Taste is a document

Everything a host decides about a verb that is not what it does: the word, the picture, the chord, the section, the drawing.

```yaml
verbs:
  todo:add:       { label: "New to-do", icon: plus, section: edit, keys: ["Mod-Enter"] }
  todo:clear-done: { label: "Clear completed", section: edit }
layers:
  - name: values-dock
    where: { kind: value }
    attrs: { manner: docked }
  - name: view-behind-menu
    where: { section: view }
    attrs: { manner: menu }
sections:
  - { id: edit, label: "Edit" }
  - { id: view, label: "View", as: menu }
```

`verbs` holds per-verb opinions keyed by id. `layers` holds rules that apply to many verbs at once, in order, later winning per key. A rule selects with a `where` of attribute equalities: `id` (exact or `prefix*`), `kind`, `argType`, or any attribute an earlier layer resolved, `null` matching absence (a value stated as `null` counts as absent). A layer sees the register as resolved so far, so judgements compose instead of being restated per verb. There is no specificity. Order is the only precedence.

A value is a literal or a **named derivation**, `{ derive: "humanize" }`, resolved by a function the host holds. That is the whole of computation allowed in a document: data as far as the vocabulary reaches, code referred to by name beyond it. So a design tool, a test, or an agent can read a host's taste without running the host.

Several documents stack root-first, the same shape at every depth: a house file, a product file, a language file.

```ts
const taste = applyTaste(register, [house, product, italian], { shout: (verb) => verb.id.toUpperCase() })
taste.attrsOf("todo:add")             // the resolved bag
taste.describe("todo:add", "manner")  // every claim, in order, the winner marked
taste.audit()                         // every (verb, key) more than one layer claimed
taste.orphans()                       // taste that reached nothing: an entry for an id not composed, a layer that selected no verb
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
const tree = project(register, state, taste, { on: "row", face: "icon", platform: "mac", includeUnavailable: false, of: 7, pending: new Set(["todo:sync"]) })
```

The register, seen from a surface, as plain JSON: sections with their members, each member a `Control` with `kind`, `as`, `label`, `icon`, the three-valued `enabled`, `reason`, `pending`, `pressed` or `value`, `appliesTo`, a formatted `shortcut`, `args`, and every other taste attribute carried through, `keys` included. No function anywhere. A toolbar, a palette, a menu, an agent and a test read the same object and cannot disagree about what is available.

A verb that does not apply (`on`) is not there at all. A group with no visible member is dropped. Withheld verbs are dropped unless `includeUnavailable` asks for them with their reasons: a menu explains, a toolbar acts. `face: "icon"` is a strip's rule, no picture no control; `words` is the floor. A taste applied to a different register is refused rather than projected unlabelled.

## Invocation

```ts
prepare(register, id, state, args, options)  // everything short of running: { ok: true, verb, args } or a refusal
invoke(register, id, state, args, options)   // prepare, then run: { ok: true, value } or the same refusal
```

A surface names a verb by id and sends a bag of args; `invoke` is the one place that decides whether it runs. It refuses, as data an agent can read, with one of five codes: `unknown` (no such verb), `inapplicable` (its `on` excludes `options.on`), `withheld` (with the verb's `reason`), `unspoken` (only when `refuseUnspoken` asks that an unspoken `enabled` count as no), and `args` (with `issues`: each arg `missing`, `undeclared`, of the wrong `type`, or outside its `domain`). What `run` returns — an action, a command, a promise — comes back untouched as `value`; dispatching it is the host's.

Arg types are an open vocabulary like derivations. The built-ins are `text`, `string`, `number`, `integer`, `boolean`, `date`, `datetime`, `url` and `email`; a host adds or replaces types with `types: { "story-points": { check, schema } }`, and lists the members of a named domain with `domains: { people: [...] }`. A type nobody defined accepts any value. `checkArgs` and `argsSchema` are exported for forms that want to validate or describe args themselves.

## The keyboard — `verbr/chord`

```ts
import { keymap, formatChord, matchChord } from "verbr/chord"
const keys = keymap(register, taste, { platform: "mac", on: "row" })
keys.lookup(event)   // the verb id a key press summons, or undefined; hand it to invoke
keys.bindings        // every { chord, id }, for a shortcuts sheet
```

Chords live in taste as `keys`, one or a list. A chord is spelled the way keymaps spell it: parts split on `-` or `+`, the last part is always the key (`Mod--` is Mod with minus), modifier spellings are read in any case (`Mod`, `Cmd`, `Ctrl`, `Control`, `Alt`, `Option`, `Shift`, `Meta`), and `Mod` is ⌘ on a Mac and Ctrl elsewhere. `formatChord` draws one for a person in the platform's order (⌃⌥⇧⌘ on a Mac, Ctrl+Alt+Shift elsewhere); the projection's `shortcut` is the first chord, drawn. `matchChord` takes anything shaped like a `KeyboardEvent`, matches letters in either case, lets Shift reach a symbol (`Mod-?`), and falls back to the physical key when a modifier changed the character (⌥K on a Mac). The keymap only maps a key press to an id — whether it may run is `invoke`'s question — and two verbs that apply in the same context and claim the same chord are refused when the keymap is built.

## Agents — `verbr/tools`

```ts
import { manifest } from "verbr/tools"
const { tools, idOf } = manifest(project(register, state, taste))
```

The projection as a tool manifest, in the Model Context Protocol's shape (`name`, `title`, `description`, `inputSchema`). An agent is offered exactly what a user could press, in the same words, with args as JSON Schema; withheld verbs are left out unless `includeUnavailable` asks. Verb ids become valid tool names (`todo:add` → `todo_add`), and `idOf` maps a tool call back to the verb for `invoke`. Other providers differ only in spelling — `input_schema`, `parameters` — which is a `map` at the host.

## The Invoker Commands outlet — `verbr/outlet`

```ts
import { commandName, verbIdOf } from "verbr/outlet"
commandName("todo:add")   // "--todo:add", for <button command="--todo:add" commandfor="app">
verbIdOf(event)           // "todo:add", or null for the platform's own commands
```

The Invoker Commands API lets a `<button command="--todo:add">` fire a native `CommandEvent` at the element it addresses, and reserves the `--` prefix for words the platform does not own. The event fires at the invokee, does not bubble, and is not composed, so a host listens in the capture phase on `document` and keeps its invokees in the light DOM. A host that needs a payload uses a form; a host that needs many targets keeps its own event for that case.

## Entry points

| Import | What it holds |
| --- | --- |
| `verbr` | The core: `compose`, `applyTaste`, `project`, `flat`, `prepare`, `invoke`, `checkArgs`, `argsSchema`, and their types |
| `verbr/chord` | The keyboard: `keymap`, `formatChord`, `parseChord`, `matchChord` |
| `verbr/tools` | Agents: `manifest` |
| `verbr/outlet` | The Invoker Commands API: `commandName`, `verbIdOf` |

## What it refuses

No DOM. No state. No subscription. No adapter for any state library or framework — the context is a type parameter and the projection is a function, which is all an adapter would have wrapped. No base class or controller for an author's element. The contract is the tool: an element receives a list of Controls and names a verb by id.

## Design notes

Where verbr came from, the rules its shape follows, and the findings that settled them are in [DESIGN.md](DESIGN.md).
