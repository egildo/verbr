// The README's walkthrough, run: if this file fails, the README is lying.
import { describe, expect, it } from "vitest"
import { keymap } from "./chord.ts"
import { applyTaste, compose, flat, invoke, isGroup, project, type Verb } from "./index.ts"
import { commandName, verbIdOf } from "./outlet.ts"
import { manifest } from "./tools.ts"

interface Todo { readonly id: string; readonly title: string; readonly done: boolean }
interface State { readonly todos: readonly Todo[]; readonly filter: "all" | "open" | "done"; readonly selected: readonly string[] }
type Action = { readonly type: string; readonly [field: string]: unknown }

const todoVerbs: Verb<State, Action>[] = [
  {
    id: "todo:add",
    run: (_s, args) => ({ type: "add", title: args?.["title"] }),
    args: [{ name: "title", type: "text", required: true }],
  },
  {
    id: "todo:complete",
    run: (s) => ({ type: "complete", ids: s.selected }),
    enabled: { some: "selected", where: { not: { rule: "done" } } },
    unavailable: () => "nothingSelected",
  },
  {
    id: "todo:clear-done",
    run: () => ({ type: "clearDone" }),
    enabled: (s) => s.todos.some((t) => t.done),
    unavailable: () => "nothingDone",
  },
  {
    id: "view:filter",
    run: (_s, args) => ({ type: "filter", show: args?.["show"] }),
    read: (s) => s.filter,
    args: [{ name: "show", domain: [{ value: "all" }, { value: "open" }, { value: "done" }] }],
  },
]

const register = compose([todoVerbs], {
  rules: { done: (t: Todo) => t.done },
  lists: { selected: (s) => s.todos.filter((t) => s.selected.includes(t.id)) },
})
const taste = applyTaste(register, {
  verbs: {
    "todo:add": { icon: "plus", keys: "Mod-Enter", section: "edit" },
    "todo:complete": { icon: "check", keys: ["Mod-d"], section: "edit" },
    "todo:clear-done": { label: "Clear completed", section: "edit" },
    "view:filter": { label: "Show", section: "view" },
  },
  sections: [{ id: "edit", label: "Edit" }, { id: "view", label: "View" }],
  reasons: { nothingSelected: "Select an open to-do", nothingDone: "Nothing is done yet" },
})

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "add": return { ...s, todos: [...s.todos, { id: String(s.todos.length + 1), title: String(a["title"]), done: false }] }
    case "complete": return { ...s, todos: s.todos.map((t) => ((a["ids"] as string[]).includes(t.id) ? { ...t, done: true } : t)), selected: [] }
    case "clearDone": return { ...s, todos: s.todos.filter((t) => !t.done) }
    case "filter": return { ...s, filter: a["show"] as State["filter"] }
    default: return s
  }
}

function makeStore(initial: State) {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    getState: () => state,
    dispatch: (a: Action) => { state = reducer(state, a); listeners.forEach((l) => l()) },
    subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l) },
  }
}

describe("the README walkthrough", () => {
  const store = makeStore({ todos: [{ id: "1", title: "Milk", done: false }, { id: "2", title: "Eggs", done: true }], filter: "all", selected: ["1"] })
  function run(id: string, args?: Readonly<Record<string, unknown>>) {
    const result = invoke(register, id, store.getState(), args, { taste })
    if (result.ok) store.dispatch(result.value)
    return result
  }

  it("a toolbar and a palette read one register and agree", () => {
    const state = store.getState()
    const toolbar = project(register, state, taste, { face: "icon" })
    expect(toolbar.map((i) => (isGroup(i) ? i.items.map((c) => c.id) : i.id))).toEqual([["todo:add", "todo:complete"], ["view:filter"]]) // the filter is a choice: it wears the member it is on
    const palette = flat(project(register, state, taste, { includeUnavailable: true, platform: "mac" }))
    expect(palette.map((c) => [c.label, c.shortcut ?? null])).toEqual([["Add", "⌘↵"], ["Complete", "⌘D"], ["Clear completed", null], ["Show", null]])
    expect(palette.find((c) => c.id === "view:filter")).toMatchObject({ kind: "choice", as: "select", value: "all" })
  })

  it("every surface runs through one funnel", () => {
    expect(run("todo:add", {})).toMatchObject({ ok: false, code: "args" })
    expect(run("todo:add", { title: "Bread" })).toMatchObject({ ok: true })
    expect(store.getState().todos.map((t) => t.title)).toEqual(["Milk", "Eggs", "Bread"])

    const keys = keymap(register, taste, { platform: "mac" })
    const id = keys.lookup({ key: "d", ctrlKey: false, altKey: false, shiftKey: false, metaKey: true })
    expect(id).toBe("todo:complete")
    run(id!)
    expect(store.getState().todos.filter((t) => t.done).map((t) => t.title)).toEqual(["Milk", "Eggs"])
    expect(run("todo:complete")).toEqual({ ok: false, id: "todo:complete", code: "withheld", cause: "nothingSelected", reason: "Select an open to-do" })

    expect(verbIdOf({ command: commandName("todo:clear-done") })).toBe("todo:clear-done")
    run("todo:clear-done")
    expect(store.getState().todos.map((t) => t.title)).toEqual(["Bread"])
  })

  it("an agent is offered the same verbs as tools, and calls back through the same funnel", () => {
    const m = manifest(project(register, store.getState(), taste))
    expect(m.tools.map((t) => t.name)).toEqual(["todo_add", "view_filter"])
    expect(m.tools[1]?.inputSchema).toEqual({ type: "object", properties: { show: { type: "string", enum: ["all", "open", "done"] } }, additionalProperties: false })
    run(m.idOf("view_filter")!, { show: "open" })
    expect(store.getState().filter).toBe("open")
  })

  it("re-projecting on every change keeps surfaces current", () => {
    const seen: number[] = []
    const stop = store.subscribe(() => seen.push(flat(project(register, store.getState(), taste)).length))
    run("todo:add", { title: "Tea" })
    stop()
    expect(seen).toEqual([2])
  })
})
