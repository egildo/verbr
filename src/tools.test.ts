import { describe, expect, it } from "vitest"
import { project } from "./project.ts"
import { compose } from "./register.ts"
import { applyTaste } from "./taste.ts"
import { manifest } from "./tools.ts"

const reg = compose([
  { id: "todo:add", run: () => 0, args: [{ name: "title", type: "text", required: true }] },
  { id: "todo:clear-done", run: () => 0, enabled: () => false },
  { id: "todo.add", run: () => 0 },
])
const taste = applyTaste(reg, { verbs: { "todo:add": { label: "Add a to-do", description: "Adds an item to the list." } } })

describe("manifest — the projection as an agent's tools", () => {
  it("offers what a user could press, with args as JSON Schema", () => {
    const m = manifest(project(reg, undefined, taste, { includeUnavailable: true }))
    expect(m.tools).toEqual([
      { name: "todo_add", title: "Add a to-do", description: "Adds an item to the list.", inputSchema: { type: "object", properties: { title: { type: "string" } }, required: ["title"], additionalProperties: false } },
      { name: "todo_add_2", title: "Todo.add", description: "Todo.add", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    ])
  })
  it("maps a tool name back to its verb id", () => {
    const m = manifest(project(reg, undefined, taste))
    expect(m.idOf("todo_add")).toBe("todo:add")
    expect(m.idOf("todo_add_2")).toBe("todo.add")
    expect(m.idOf("nope")).toBeUndefined()
  })
  it("offers withheld verbs only when asked", () => {
    const m = manifest(project(reg, undefined, taste, { includeUnavailable: true }), { includeUnavailable: true })
    expect(m.tools.map((t) => t.name)).toContain("todo_clear-done")
  })
})
