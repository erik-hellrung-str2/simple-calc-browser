import js from "@eslint/js";
import html from "eslint-plugin-html";
import globals from "globals";

export default [
  { ignores: ["node_modules/", ".cache/", "test-cache/", "coverage/", "test-results/", "playwright-report/"] },
  js.configs.recommended,
  {
    // The builder keeps its modules in <script type="text/plain" id="cv-*-src"> blocks (spec §4.2); lint them as JS too.
    files: ["**/*.html"],
    plugins: { html },
    settings: { "html/javascript-mime-types": ["text/javascript", "module", "text/plain"] },
    languageOptions: { sourceType: "module", globals: globals.browser },
  },
  { files: ["**/*.mjs"], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  { files: ["**/*.cjs"], languageOptions: { sourceType: "commonjs", globals: globals.node } },
];
