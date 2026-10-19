# Design notes

What verbr's shape follows, where it came from, and what the first build settled. The README says how to use it; this file says why it is this way.

## Rules

**Declared once, projected everywhere.** A capability is data with an id. A surface never asks the host's state what it can do; it reads a projection of the register. So a toolbar, a menu, a palette, a keyboard, an agent and a test cannot disagree about what is available, because none of them decides it.

**One door.** Every surface names a verb by id and hands `invoke` a bag of args. Availability, applicability and the shape of the args are checked there and nowhere else, so a shortcut cannot run what a button refuses, and an agent's tool call is refused in the same words a person would read.

**Three-valued availability.** `enabled` answers `true`, `false`, or nothing yet. Collapsing the third value into either of the others makes a surface lie: dimming what may well be allowed, or offering what may well be refused. The projection carries silence as an absent key.

**Applicability is not availability.** Where a verb lives at all (`on`) is a different question from whether it may run this moment (`enabled`). A verb that does not apply is absent, not dimmed, and owes no reason.

**Data as far as the vocabulary reaches, code by name beyond it.** A taste document holds no function. Where a value must be computed, the document names a function the host holds (`{ derive: "humanize" }`), and the host must hold it or the document is refused. Guards apply the same rule to availability (`{ rule: "locked" }`), and arguments to their types and domains; all of them are names resolved by the one vocabulary handed to `compose`, refused there when the host does not hold them. A type is fixed and a domain's members are read from the context, because one is a shape and the other is state. That is what lets a design tool, a test or an agent read a host's taste without running the host.

**A cascade owes sight, not refusal — except where the taste could only mislead.** Order is the only precedence; `describe`, `audit` and `orphans` show who claimed what. Refusal is kept for taste that could never be right: reaching a capability, stating what the projection reads from the context, selecting on something that can never match, naming a derivation or section that does not exist.

**No state, no DOM, no adapters.** The context is a type parameter and the projection is a pure function. An adapter for a state library would wrap one function call; the README shows the call instead.

**A cause is a name; a reason is words.** Which leaf withheld a verb is capability; the sentence a person reads is taste, and a language file must be able to change it. So every withheld answer carries both, under `cause` and `reason`. Google's error model spells the stable name `reason` and the words `message`; verbr keeps `reason` for the words because a `Control` already meant that, and that is deliberate, not an oversight to correct.

## Provenance

verbr was born in rich-text editing, where ProseMirror has commands but no register of them, and three registers had been built separately before they turned out to be one thing: `@sibar/verbs` in sibardoc-prototype, prosemirror-verbs, and Nodemirror's action catalogue.

The verb contract is `@sibar/verbs`' with three-valued availability and a type parameter for context. Composition, the cascade with sight, the face rule and the control tree are prosemirror-verbs'. The action catalogue as the source of kinds is Nodemirror's. The rule that a document holds data as far as a vocabulary reaches and names code beyond it is Nodemirror's Law (and Cascata's freeze), applied to taste.

## Findings from the first build

Recorded so they are not rediscovered.

- The naming default needed `where: { label: null }` to be a floor rather than an override, and that is a rule with a selection, not an unconditional layer.
- Hiding what is unavailable was never taste; it is the projection's option.
- The icon face first dropped every verb without an icon, choices and values included. The ancestor applied it only to actions and toggles, and the venue had to restore that by hand: a choice wears the member it is on and a value is its field, so a picture was never their face.
- Of the two rules for `value` in the ancestors, the one that does not require a readback was kept, so a payload field with nothing to read back is still a field.
- A section, a derivation and a kind are closed vocabularies: a name nobody declared is refused at build rather than silently dropping a verb from a surface.
- A verb that applies to none of a selection is withheld, not shown as «0 of N».
- The «n of N» belongs to `some`, not to `every`. The ancestor read it off `every` plus a flag, but "every" means every, and 3 of 7 is a withheld verb.
- The count's total was once a projection option while its `n` came from the verb, two sources free to disagree. Both now come from one place: the guard's list, or `appliesTo` returning `{ n, of }`.
- `every` over an empty list is false, not vacuously true, because a bulk verb with nothing selected has nothing to do.
- Availability was computed twice, once by the projection and once by `invoke`, in copies of the same line. Guards made the copies diverge on day one, so there is one verdict both call.
- Arg types and domains first arrived at each `invoke` and each `manifest` call, so the schema an agent was shown and the check it met could come from different options, and an unknown name passed silently. They moved to the vocabulary at `compose`, the projection states members and schemas, and the door reads the same.
- A required choice over an empty domain is withheld, the domain its cause. The ancestor's «Nuovo documento» stayed enabled with no folder to pick; that is the bug this settles.
- Running a verb belongs in the library after all, as one checked door (`invoke`), because every host was writing the same lookup, availability check and args check, and every surface — keyboard, palette, agent — needed the same answer.

## Where each ancestor's field landed

Every field of the three registers, and its home here. A field with no home would have meant the union needed a new word; none did. The executable half of this claim — a verb carrying every field composes and projects — is `src/predictions.test.ts`.

| Source | Field | Home in verbr |
| --- | --- | --- |
| `@sibar/verbs` / `@sibar/model` | `Verb.id` | Verb.id |
| `@sibar/verbs` / `@sibar/model` | `Verb.affects` | Verb[extra] (a REST host's extension) |
| `@sibar/verbs` / `@sibar/model` | `Verb.enabled` | Verb.enabled (now boolean | undefined) |
| `@sibar/verbs` / `@sibar/model` | `Verb.unavailable` | Verb.unavailable |
| `@sibar/verbs` / `@sibar/model` | `Verb.read` | Verb.read |
| `@sibar/verbs` / `@sibar/model` | `Verb.appliesTo` | Verb.appliesTo |
| `@sibar/verbs` / `@sibar/model` | `Verb.args` | Verb.args |
| `@sibar/verbs` / `@sibar/model` | `Verb.run` | Verb.run |
| `@sibar/verbs` / `@sibar/model` | `Verb.danger` | Verb[extra] → Control[attr] |
| `@sibar/verbs` / `@sibar/model` | `Verb.heavy` | Verb[extra] → Control[attr] |
| `@sibar/verbs` / `@sibar/model` | `Verb.placeholder` | Verb[extra] → Control[attr] |
| `@sibar/verbs` / `@sibar/model` | `Verb.collector` | Verb[extra] → Control[attr] |
| `@sibar/verbs` / `@sibar/model` | `VerbArg.id` | VerbArg.name (rename) |
| `@sibar/verbs` / `@sibar/model` | `VerbArg.label` | VerbArg[extra] (taste) |
| `@sibar/verbs` / `@sibar/model` | `VerbArg.domain` | VerbArg.domain as a name |
| `@sibar/verbs` / `@sibar/model` | `VerbArg.required` | VerbArg.required |
| `@sibar/verbs` / `@sibar/model` | `VerbArg.input` | VerbArg.type (rename) |
| `@sibar/verbs` / `@sibar/model` | `Control.id` | Control.id |
| `@sibar/verbs` / `@sibar/model` | `Control.label` | Control.label |
| `@sibar/verbs` / `@sibar/model` | `Control.icon` | Control.icon |
| `@sibar/verbs` / `@sibar/model` | `Control.kind` | Control.kind |
| `@sibar/verbs` / `@sibar/model` | `Control.enabled` | Control.enabled (absent when unspoken) |
| `@sibar/verbs` / `@sibar/model` | `Control.pending` | Control.pending |
| `@sibar/verbs` / `@sibar/model` | `Control.pressed` | Control.pressed |
| `@sibar/verbs` / `@sibar/model` | `Control.reason` | Control.reason |
| `@sibar/verbs` / `@sibar/model` | `Control.description` | Control[attr] (taste) |
| `@sibar/verbs` / `@sibar/model` | `Control.appliesTo` | Control.appliesTo |
| `@sibar/verbs` / `@sibar/model` | `Control.danger` | Control[attr] |
| `@sibar/verbs` / `@sibar/model` | `Control.heavy` | Control[attr] |
| `@sibar/verbs` / `@sibar/model` | `Control.shortcut` | Control.shortcut |
| `@sibar/verbs` / `@sibar/model` | `Control.placeholder` | Control[attr] |
| `@sibar/verbs` / `@sibar/model` | `Control.args` | Control.args |
| `@sibar/verbs` / `@sibar/model` | `Control.collector` | Control[attr] |
| `@sibar/verbs` / `@sibar/model` | `VerbGroupView` | Group |
| `@sibar/verbs` / `@sibar/model` | `Effect` | Run (the host's own type parameter) |
| prosemirror-verbs | `Capability.id` | Verb.id |
| prosemirror-verbs | `Capability.command` | Verb.run (normalized: args are run's second parameter) |
| prosemirror-verbs | `Capability.read` | Verb.read |
| prosemirror-verbs | `Capability.enabled` | Verb.enabled |
| prosemirror-verbs | `Capability.args` | Verb.args |
| prosemirror-verbs | `Verb.run` | Verb.run |
| prosemirror-verbs | `VerbEntry.label` | Taste.verbs[id].label or declared floor |
| prosemirror-verbs | `VerbEntry.icon` | Taste.verbs[id].icon |
| prosemirror-verbs | `VerbEntry.as` | Taste.verbs[id].as |
| prosemirror-verbs | `VerbEntry.keys` | Taste.verbs[id].keys |
| prosemirror-verbs | `VerbEntry.keywords` | Taste.verbs[id].keywords (open bag) |
| prosemirror-verbs | `VerbEntry.group` | Taste.verbs[id].section (rename) |
| prosemirror-verbs | `VerbArg.name` | VerbArg.name |
| prosemirror-verbs | `VerbArg.type` | VerbArg.type |
| prosemirror-verbs | `VerbArg.domain` | VerbArg.domain as inline members |
| prosemirror-verbs | `DomainMember.value` | DomainMember.value |
| prosemirror-verbs | `DomainMember.label/icon/keys` | DomainMember[extra] (taste) |
| prosemirror-verbs | `AttrLayer.name` | Layer.name |
| prosemirror-verbs | `AttrLayer.match` | Layer.where (data, not a predicate) |
| prosemirror-verbs | `AttrLayer.attrs` | Layer.attrs (literal or named Derivation) |
| prosemirror-verbs | `Attributed.describe` | Attributed.describe |
| prosemirror-verbs | `Attributed.audit` | Attributed.audit |
| prosemirror-verbs | `namingLayer` | NAMING |
| prosemirror-verbs | `ControlSpec.kind` | Control.kind |
| prosemirror-verbs | `ControlSpec.as` | Control.as |
| prosemirror-verbs | `ControlSpec.label` | Control.label |
| prosemirror-verbs | `ControlSpec.title` | Control[attr] (taste) |
| prosemirror-verbs | `ControlSpec.icon` | Control.icon |
| prosemirror-verbs | `ControlSpec.command` | not projected: a Control holds no function; the host runs by id |
| prosemirror-verbs | `ControlSpec.active` | Control.pressed |
| prosemirror-verbs | `ControlSpec.value` | Control.value |
| prosemirror-verbs | `ControlSpec.write` | not projected: the host runs by id with args |
| prosemirror-verbs | `ControlSpec.options` | Control.args[0].domain |
| prosemirror-verbs | `ControlSpec.type` | Control.args[0].type |
| prosemirror-verbs | `ControlSpec.keys` | Control.shortcut (formatted) + Control[attr] keys |
| prosemirror-verbs | `ControlSpec.group` | Control.section |
| prosemirror-verbs | `GroupSpec` | Section |
| prosemirror-verbs | `ControlGroup` | Group |
| prosemirror-verbs | `FaceRule` | Face |
| Nodemirror | `ActionSchema.type` | Verb.id |
| Nodemirror | `ActionSchema.maxSelection` | Verb[extra] (the host's arity) |
| Nodemirror | `ActionSchema.payload` | Verb.args (one per payload field, type from the cell) |
| Nodemirror | `actions conclusion` | Verb.enabled reading the spoken list; undefined when unspoken |
| Nodemirror | `defineActions.labels` | Taste.verbs[id].label |
