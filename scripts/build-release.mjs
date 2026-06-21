import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  cpSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const tauriDir = resolve(root, "src-tauri");
const backendSrc = resolve(root, "backend");
const backendDest = resolve(tauriDir, "backend");
const confPath = resolve(tauriDir, "tauri.conf.json");
const cargoPath = resolve(tauriDir, "Cargo.toml");
const pkgPath = resolve(root, "package.json");
const releaseDir = resolve(root, "release");
const targetDir = resolve(tauriDir, "target");

// ── helpers ──────────────────────────────────────────────────────────

function log(msg) {
  process.stdout.write(`[build-release] ${msg}\n`);
}

function fmtSize(bytes) {
  if (bytes >= 1_073_741_824)
    return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

function collectDirs(parent, name) {
  const results = [];
  try {
    const entries = readdirSync(parent, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const full = resolve(parent, e.name);
      if (e.name === name) {
        results.push(full);
      } else if (!e.name.startsWith(".") && e.name !== "node_modules") {
        results.push(...collectDirs(full, name));
      }
    }
  } catch {
    // Skip unreadable directories
  }
  return results;
}

// ── main ─────────────────────────────────────────────────────────────

let confBackup = null;
let cargoBackup = null;
const startTime = Date.now();

try {
  // Ensure release/ dir exists
  if (!existsSync(releaseDir)) {
    mkdirSync(releaseDir, { recursive: true });
  }

  // ── 1. Read version from package.json ──────────────────────────────
  log("Reading version from package.json...");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const version = pkg.version;
  const productName = "ZOOBET Search";
  log(`  Version: ${version}`);
  log(`  Product: ${productName}`);

  // ── 2. Inject version into tauri.conf.json ─────────────────────────
  log("Injecting version into tauri.conf.json...");
  confBackup = readFileSync(confPath, "utf-8");
  const conf = JSON.parse(confBackup);
  const prevVersion = conf.version;
  conf.version = version;
  conf.bundle = conf.bundle || {};
  conf.bundle.resources = { "backend/": "backend/" };
  writeFileSync(confPath, JSON.stringify(conf, null, 2) + "\n", "utf-8");
  log(`  ${prevVersion} → ${version}, resources configured`);

  // ── 3. Inject version into Cargo.toml ──────────────────────────────
  log("Injecting version into Cargo.toml...");
  cargoBackup = readFileSync(cargoPath, "utf-8");
  const cargoUpdated = cargoBackup.replace(
    /^version\s*=\s*"[^"]*"/m,
    `version = "${version}"`
  );
  if (cargoUpdated !== cargoBackup) {
    writeFileSync(cargoPath, cargoUpdated, "utf-8");
    log("  Cargo.toml version synced");
  } else {
    log("  (unchanged)");
  }

  // ── 4. Copy backend into src-tauri/ for bundling ──────────────────
  log("Copying backend/ into src-tauri/backend/...");
  if (existsSync(backendDest)) {
    rmSync(backendDest, { recursive: true, force: true });
  }
  cpSync(backendSrc, backendDest, { recursive: true, dereference: true });
  // Remove __pycache__ dirs to trim bundle size
  const pycacheDirs = collectDirs(backendDest, "__pycache__");
  for (const d of pycacheDirs) {
    rmSync(d, { recursive: true, force: true });
  }
  log(`  Done (removed ${pycacheDirs.length} __pycache__ dirs)`);

  // ── 5. Build with Tauri bundler ───────────────────────────────────
  log("Running tauri build --ci (MSI + NSIS)...");
  log("  This compiles Rust in release mode, builds the frontend,");
  log("  and creates installers.");
  log("");

  let buildSucceeded = false;
  try {
    execSync("npx tauri build --ci", {
      cwd: root,
      stdio: "inherit",
      shell: true,
    });
    buildSucceeded = true;
  } catch (buildErr) {
    log(`Tauri build exited with error: ${buildErr.message}`);
    log("Checking for partial artifacts...");
  }

  // ── 6. Verify build artifacts ─────────────────────────────────────
  log("");
  log("=== Verifying build artifacts ===");

  const artifacts = {};

  // MSI
  const msiDir = resolve(targetDir, "release/bundle/msi");
  if (existsSync(msiDir)) {
    const entries = readdirSync(msiDir).filter((f) => f.endsWith(".msi"));
    if (entries.length > 0) {
      const msiPath = resolve(msiDir, entries[0]);
      const msiSize = statSync(msiPath).size;
      const ok = msiSize > 5_000_000;
      artifacts.msi = { name: entries[0], size: msiSize, path: msiPath };
      log(
        `  MSI:    ${entries[0]}  ${fmtSize(msiSize)}  [${ok ? "OK" : "SIZE WARN"}]`
      );
    } else {
      log("  MSI:    no .msi file found");
    }
  } else {
    log(`  MSI:    directory not found`);
  }

  // NSIS
  const nsisDir = resolve(targetDir, "release/bundle/nsis");
  if (existsSync(nsisDir)) {
    const entries = readdirSync(nsisDir).filter(
      (f) => f.endsWith(".exe") && f.toLowerCase().includes("setup")
    );
    if (entries.length > 0) {
      const nsisPath = resolve(nsisDir, entries[0]);
      const nsisSize = statSync(nsisPath).size;
      const ok = nsisSize > 5_000_000;
      artifacts.nsis = { name: entries[0], size: nsisSize, path: nsisPath };
      log(
        `  NSIS:   ${entries[0]}  ${fmtSize(nsisSize)}  [${ok ? "OK" : "SIZE WARN"}]`
      );
    } else {
      log("  NSIS:   no setup .exe found");
    }
  } else {
    log(`  NSIS:   directory not found`);
  }

  // Release binary
  const exeName =
    process.platform === "win32"
      ? "zoobet-image-search.exe"
      : "zoobet-image-search";
  const binaryPath = resolve(targetDir, "release", exeName);
  if (existsSync(binaryPath)) {
    const binarySize = statSync(binaryPath).size;
    artifacts.binary = { name: exeName, size: binarySize, path: binaryPath };
    log(`  Binary: ${exeName}  ${fmtSize(binarySize)}  [OK]`);
  } else {
    log(`  Binary: not found`);
  }

  // ── 7. Generate build report ──────────────────────────────────────
  log("");
  log("Generating build report...");

  const buildTimestamp = new Date().toISOString();
  const buildDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  const allExist = Object.keys(artifacts).length > 0;
  const sizeOk = Object.values(artifacts).every((a) => a.size > 1_000_000);
  const verified = allExist && sizeOk;

  // JSON report
  const jsonReport = {
    version,
    productName,
    buildTimestamp,
    buildDurationSeconds: parseFloat(buildDuration),
    buildSucceeded,
    platform: process.platform,
    arch: process.arch,
    targets: ["msi", "nsis"],
    artifacts: Object.fromEntries(
      Object.entries(artifacts).map(([k, v]) => [
        k,
        { name: v.name, size: v.size, sizeHuman: fmtSize(v.size) },
      ])
    ),
    verification: {
      artifactsExist: allExist,
      sizeChecksPassed: sizeOk,
      artifactCount: Object.keys(artifacts).length,
      overall: verified ? "PASS" : "FAIL",
    },
  };
  writeFileSync(
    resolve(releaseDir, "build-report.json"),
    JSON.stringify(jsonReport, null, 2) + "\n",
    "utf-8"
  );

  // Markdown report
  const mdLines = [
    `# Build Report — ${productName} v${version}`,
    "",
    `| Field | Value |`,
    `|-------|-------|`,
    `| Version | ${version} |`,
    `| Build time | ${buildTimestamp} |`,
    `| Duration | ${buildDuration}s |`,
    `| Platform | ${process.platform} (${process.arch}) |`,
    `| Targets | MSI, NSIS |`,
    `| Tauri build | ${buildSucceeded ? "SUCCESS" : "FAILED (partial)"} |`,
    `| Verification | ${verified ? "PASS" : "ISSUES FOUND"} |`,
    "",
    "## Artifacts",
    "",
    "| Type | File | Size |",
    "|------|------|------|",
  ];
  for (const [type, a] of Object.entries(artifacts)) {
    mdLines.push(`| ${type} | ${a.name} | ${fmtSize(a.size)} |`);
  }
  if (Object.keys(artifacts).length === 0) {
    mdLines.push("| — | No artifacts found | — |");
  }
  mdLines.push("", "## Verification", "");
  mdLines.push(
    `- Artifacts present: ${allExist ? "YES" : "NO (missing some artifacts)"}`
  );
  mdLines.push(
    `- Size checks: ${sizeOk ? "ALL PASS" : "SOME FAILED (<1 MB)"}`
  );
  mdLines.push(`- Total artifacts found: ${Object.keys(artifacts).length}`);
  mdLines.push("");

  writeFileSync(
    resolve(releaseDir, "build-report.md"),
    mdLines.join("\n"),
    "utf-8"
  );

  log(`  ${releaseDir}/build-report.json`);
  log(`  ${releaseDir}/build-report.md`);

  // ── 8. Summary ────────────────────────────────────────────────────
  log("");
  log(`=== Build complete in ${buildDuration}s ===`);
  log(`Version:     ${version}`);
  log(`Artifacts:   ${Object.keys(artifacts).length} found`);
  log(`Verification: ${verified ? "PASS" : "FAIL"}`);
  if (!verified) {
    log("WARNING: Verification checks failed. See report above.");
    process.exitCode = 1;
  }
} catch (err) {
  log(`FATAL: ${err.message}`);
  if (err.stderr) {
    process.stderr.write(err.stderr);
  }
  process.exitCode = 1;
} finally {
  // ── 9. Restore original config files ──────────────────────────────
  if (confBackup !== null) {
    log("Restoring tauri.conf.json...");
    writeFileSync(confPath, confBackup, "utf-8");
  }
  if (cargoBackup !== null) {
    log("Restoring Cargo.toml...");
    writeFileSync(cargoPath, cargoBackup, "utf-8");
  }

  // ── 10. Clean up backend copy ─────────────────────────────────────
  if (existsSync(backendDest)) {
    log("Removing src-tauri/backend/ copy...");
    rmSync(backendDest, { recursive: true, force: true });
  }

  log("Cleanup done.");
}
