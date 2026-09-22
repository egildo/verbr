import js from "@eslint/js"
import tseslint from "typescript-eslint"

export default tseslint.config(
  { ignores: ["dist/", "node_modules/"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      // With `noUncheckedIndexedAccess`, `!` is how the house says an index is known to be present.
      "@typescript-eslint/no-non-null-assertion": "off",
      // `_`-prefixed bindings are the house way of dropping a key from a rest spread.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
)
