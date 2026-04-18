// MiroFish frontend lint config.
// Run with: `yarn lint` or `yarn lint:fix`
// Catches: missing React hook deps, missing array keys, unused imports, debugger statements.
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import unusedImports from "eslint-plugin-unused-imports";

export default [
  {
    files: ["src/**/*.{js,jsx}"],
    ignores: [
      "node_modules/**",
      "build/**",
      "src/components/ui/**",
      "src/hooks/use-toast.js",   // shadcn-generated file
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        WebSocket: "readonly",
        fetch: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      react,
      "unused-imports": unusedImports,
    },
    rules: {
      // Real bug catchers (kept strict)
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react/jsx-key": ["warn", { checkFragmentShorthand: true }],
      "react/jsx-no-target-blank": "warn",
      "react/jsx-uses-vars": "error",     // treat <Foo/> usage as a var use
      "react/jsx-uses-react": "error",    // handle classic React-in-scope
      "no-debugger": "error",

      // Hygiene (unused-imports plugin auto-removes; --fix is safe)
      "no-unused-vars": "off",
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": ["warn", {
        vars: "all",
        varsIgnorePattern: "^_",
        args: "after-used",
        argsIgnorePattern: "^_",
      }],

      // Keep console.warn/error intentionally — gate console.log behind NODE_ENV
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
    settings: { react: { version: "detect" } },
  },
];

