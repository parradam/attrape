import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import tailwind from "eslint-plugin-better-tailwindcss";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    rules: {
      // Allow `onClick={() => setOpen(true)}`, the usual React shorthand.
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
      // Allow numbers in template strings, e.g. `/api/tasks/${id}`.
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "better-tailwindcss": tailwind },
    settings: { "better-tailwindcss": { entryPoint: "src/index.css" } },
    rules: {
      ...tailwind.configs["recommended-error"].rules,
      // Prettier owns class order and line wrapping.
      "better-tailwindcss/enforce-consistent-class-order": "off",
      "better-tailwindcss/enforce-consistent-line-wrapping": "off",
      // Match the VS Code Tailwind extension, which treats 16px as 1rem.
      "better-tailwindcss/enforce-canonical-classes": ["error", { rootFontSize: 16 }],
    },
  },
  {
    // `await act(async () => ...)` is React's idiom for flushing async updates.
    files: ["src/**/*.test.{ts,tsx}"],
    rules: { "@typescript-eslint/require-await": "off" },
  },
  {
    files: ["eslint.config.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
