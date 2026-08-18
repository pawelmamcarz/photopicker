import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Wirtualne srodowisko Pythona (739 MB, m.in. PyTorch). Git ignoruje je przez
    // .venv/.gitignore tworzony przez modul venv, ale ESLint o tym nie wie i bez
    // tego wpisu lintowal zminifikowany JS z paczek pythonowych.
    ".venv/**",
  ]),
]);

export default eslintConfig;
