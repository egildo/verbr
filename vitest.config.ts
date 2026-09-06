import { defineConfig } from "vitest/config"

// Headless by construction: the library owns no DOM, so its tests need none. `lib` excludes DOM
// in tsconfig for the same reason — a DOM type reaching a public surface is a fence breach.
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } })
