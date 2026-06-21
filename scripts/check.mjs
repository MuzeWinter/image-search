import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const results = [];

function run(name, command, cwd = root) {
  process.stdout.write(`\n=== ${name} ===\n`);
  try {
    execSync(command, { cwd, stdio: "inherit", shell: true });
    process.stdout.write(`[PASS] ${name}\n`);
    results.push({ name, ok: true });
  } catch {
    process.stdout.write(`[FAIL] ${name}\n`);
    results.push({ name, ok: false });
  }
}

// 1. TypeScript type check
run("tsc --noEmit", "npx tsc --noEmit");

// 2. ESLint
run("eslint", "npx eslint .");

// 3. Vite build
run("vite build", "npx vite build");

// 4. Cargo build (Rust/Tauri)
run("cargo build", "cargo build", resolve(root, "src-tauri"));

// 5. Python syntax check
run("python syntax", "python -m py_compile backend/main.py && python -m compileall -q backend/");

// 6. mypy (static type checking)
run("mypy", "python -m mypy backend/");

// 7. pytest
run("pytest", "python -m pytest backend/tests/ -v");

// Summary
process.stdout.write(`\n${"=".repeat(40)}\n`);
const passed = results.filter((r) => r.ok).length;
const total = results.length;
process.stdout.write(`Results: ${passed}/${total} passed\n`);

results.forEach((r) => {
  process.stdout.write(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name}\n`);
});

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  process.stdout.write(`\n${failed.length} check(s) failed.\n`);
  process.exit(1);
}

process.stdout.write("All checks passed.\n");
