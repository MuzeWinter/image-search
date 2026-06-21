# Claude Code 任务单：v2-11 — 注册缺失的 Rust 系统命令

遵守全部规则文件。

## 问题
前端 `systemService.ts` 调用 `invoke("system.openFolder")` 和 `invoke("system.openFile")`，但 Rust 端未注册这两个命令。

## 必须实现
1. 在 `src-tauri/src/main.rs` 添加两个 #[tauri::command]:
   - `open_file(path: String)` → 用 shell plugin 或 std::process::Command 打开文件
   - `open_folder(path: String)` → 用 explorer.exe 打开文件夹
2. 在 `main()` 的 `invoke_handler` 中注册这两个命令
3. `cargo build` 通过
4. `npm run build` 通过

## 实现参考
```rust
#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    opener::open(&path).map_err(|e| format!("Failed to open: {}", e))
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    let dir = std::path::Path::new(&path);
    let folder = if dir.is_file() { dir.parent().unwrap_or(dir) } else { dir };
    opener::open(folder).map_err(|e| format!("Failed to open: {}", e))
}
```
如果没有 opener crate，用 `std::process::Command::new("explorer").arg(path)` 替代。

## 不执行 git commit/push
