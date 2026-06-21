import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const results = [];

function run(name, command, cwd = root, opts = {}) {
  process.stdout.write(`\n=== ${name} ===\n`);
  const { detectWarnings = false } = opts;
  try {
    const stdio = detectWarnings ? "pipe" : "inherit";
    const output = execSync(command, { cwd, stdio, shell: true, encoding: "utf-8" });
    if (detectWarnings) {
      const warnings = [...output.matchAll(/warning:/gi)];
      if (warnings.length > 0) {
        process.stdout.write(output);
        process.stdout.write(`[FAIL] ${name} — ${warnings.length} Rust warning(s) detected\n`);
        results.push({ name, ok: false });
        return;
      }
    }
    process.stdout.write(`[PASS] ${name}\n`);
    results.push({ name, ok: true });
  } catch (err) {
    if (detectWarnings && err.stderr) {
      process.stderr.write(err.stderr.toString());
    }
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
run("cargo build", "cargo build 2>&1", resolve(root, "src-tauri"), { detectWarnings: true });

// 5. Python syntax check
run("python syntax", "python -m py_compile backend/main.py && python -m compileall -q backend/");

// 6. mypy (static type checking)
run("mypy", "python -m mypy backend/");

// 7. pytest
run("pytest", "python -m pytest backend/tests/ -v");

// 8. vitest (frontend tests)
run("vitest", "npx vitest run");

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