#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::panic;
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::Mutex;
use std::time::Duration;
use tauri::Emitter;
use tauri::Manager;
use notify::{Event, EventKind, RecursiveMode, Watcher};

mod export;

#[derive(Debug, Default)]
struct StartupArgs {
    scan_path: Option<String>,
    search_path: Option<String>,
}

fn parse_startup_args() -> StartupArgs {
    let args: Vec<String> = std::env::args().collect();
    let mut result = StartupArgs::default();
    let mut i = 0;
    while i < args.len() {
        if args[i] == "--scan" && i + 1 < args.len() {
            i += 1;
            result.scan_path = Some(args[i].clone());
        } else if args[i] == "--search" && i + 1 < args.len() {
            i += 1;
            result.search_path = Some(args[i].clone());
        }
        i += 1;
    }
    result
}

#[tauri::command]
fn get_startup_args(
    state: tauri::State<'_, Mutex<StartupArgs>>,
) -> serde_json::Value {
    let mut args = state.lock().unwrap();
    serde_json::json!({
        "scanPath": args.scan_path.take(),
        "searchPath": args.search_path.take(),
    })
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
struct WindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

fn window_state_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir error: {}", e))?;
    fs::create_dir_all(&dir).map_err(|e| format!("create app data dir error: {}", e))?;
    Ok(dir.join("window_state.json"))
}

fn read_window_states(app_handle: &tauri::AppHandle) -> HashMap<String, WindowState> {
    let path = match window_state_path(app_handle) {
        Ok(p) => p,
        Err(_) => return HashMap::new(),
    };
    if !path.exists() {
        return HashMap::new();
    }
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => HashMap::new(),
    }
}

fn write_window_states(
    app_handle: &tauri::AppHandle,
    states: &HashMap<String, WindowState>,
) -> Result<(), String> {
    let path = window_state_path(app_handle)?;
    let json = serde_json::to_string_pretty(states).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("write window state error: {}", e))
}

#[tauri::command]
fn save_window_state(
    app_handle: tauri::AppHandle,
    window_label: String,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
) -> Result<(), String> {
    let mut states = read_window_states(&app_handle);
    states.insert(
        window_label,
        WindowState {
            x,
            y,
            width,
            height,
            maximized,
        },
    );
    write_window_states(&app_handle, &states)
}

#[tauri::command]
fn load_window_state(
    app_handle: tauri::AppHandle,
    window_label: String,
) -> Result<Option<WindowState>, String> {
    let states = read_window_states(&app_handle);
    Ok(states.get(&window_label).cloned())
}

fn is_position_on_screen(
    window: &tauri::WebviewWindow,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> bool {
    let monitors = match window.available_monitors() {
        Ok(m) => m,
        Err(_) => return false,
    };
    if monitors.is_empty() {
        return false;
    }
    let wx = x as f64;
    let wy = y as f64;
    let ww = width as f64;
    let wh = height as f64;
    for monitor in monitors {
        let mp = monitor.position();
        let ms = monitor.size();
        let mx = mp.x as f64;
        let my = mp.y as f64;
        let mw = ms.width as f64;
        let mh = ms.height as f64;
        if wx < mx + mw && wx + ww > mx && wy < my + mh && wy + wh > my {
            return true;
        }
    }
    false
}

static PYTHON_LOCK: Mutex<()> = Mutex::new(());
static SCAN_CHILD: Mutex<Option<Child>> = Mutex::new(None);
static BACKEND_FAILURES: Mutex<u32> = Mutex::new(0);

// ── Folder watch state ────────────────────────────────────────
static FOLDER_WATCHER: Mutex<Option<notify::RecommendedWatcher>> = Mutex::new(None);
static DEBOUNCE_TX: Mutex<Option<mpsc::Sender<()>>> = Mutex::new(None);
static WATCHED_PATHS: Mutex<Vec<String>> = Mutex::new(vec![]);

const DEFAULT_MAX_RETRIES: u32 = 2;
const DEFAULT_RETRY_DELAY_MS: u64 = 500;

fn resolve_backend_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("resource dir error: {}", e))?;

    let main_py = resource_dir.join("backend").join("main.py");
    if main_py.exists() {
        return Ok(main_py);
    }

    let cwd = std::env::current_dir().map_err(|e| format!("cwd error: {}", e))?;
    let dev_path = cwd.join("backend").join("main.py");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    Err(format!(
        "backend/main.py not found. looked in: {:?} and {:?}",
        main_py, dev_path
    ))
}

fn resolve_backend_dir(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let backend_path = resolve_backend_path(app_handle)?;
    Ok(backend_path.parent().unwrap().to_path_buf())
}

fn find_python() -> &'static str {
    if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    }
}

fn find_error_report_script() -> Option<PathBuf> {
    let cwd = std::env::current_dir().ok()?;
    let dev_path = cwd
        .join("backend")
        .join("services")
        .join("error_report_service.py");
    if dev_path.exists() {
        return Some(dev_path);
    }
    let exe = std::env::current_exe().ok()?;
    if let Some(exe_dir) = exe.parent() {
        let pkg_path = exe_dir
            .join("backend")
            .join("services")
            .join("error_report_service.py");
        if pkg_path.exists() {
            return Some(pkg_path);
        }
        let res_path = exe_dir
            .join("_up_")
            .join("backend")
            .join("services")
            .join("error_report_service.py");
        if res_path.exists() {
            return Some(res_path);
        }
    }
    None
}

fn spawn_error_report(trigger: &str, context: &str) {
    let script = match find_error_report_script() {
        Some(s) => s,
        None => {
            eprintln!("[rust] Cannot find error_report_service.py, skipping error report");
            return;
        }
    };
    let python = find_python();
    match Command::new(python)
        .arg(&script)
        .arg("--trigger")
        .arg(trigger)
        .arg("--context")
        .arg(context)
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
    {
        Ok(mut child) => {
            let _ = child.wait();
        }
        Err(e) => {
            eprintln!("[rust] Failed to spawn error report: {}", e);
        }
    }
}

fn backend_failure_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir error: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("create app data dir error: {}", e))?;
    Ok(dir.join("backend_failures.json"))
}

fn load_failure_count(app_handle: &tauri::AppHandle) -> u32 {
    let path = match backend_failure_path(app_handle) {
        Ok(p) => p,
        Err(_) => return 0,
    };
    if !path.exists() {
        return 0;
    }
    match std::fs::read_to_string(&path) {
        Ok(content) => {
            let v: serde_json::Value = serde_json::from_str(&content).unwrap_or_default();
            v.get("count").and_then(|c| c.as_u64()).unwrap_or(0) as u32
        }
        Err(_) => 0,
    }
}

fn save_failure_count(app_handle: &tauri::AppHandle, count: u32) {
    let path = match backend_failure_path(app_handle) {
        Ok(p) => p,
        Err(_) => return,
    };
    let json = serde_json::json!({"count": count});
    if let Ok(s) = serde_json::to_string(&json) {
        let _ = std::fs::write(&path, s);
    }
}

fn track_backend_failure(app_handle: &tauri::AppHandle) {
    let mut count_guard = match BACKEND_FAILURES.lock() {
        Ok(g) => g,
        Err(_) => return,
    };
    let saved = load_failure_count(app_handle);
    let current = if saved > *count_guard { saved } else { *count_guard };
    let new_count = current + 1;
    *count_guard = new_count;
    save_failure_count(app_handle, new_count);

    if new_count >= 3 {
        spawn_error_report(
            "startup-failure",
            &format!("Python backend failed to start {} consecutive times", new_count),
        );
        *count_guard = 0;
        save_failure_count(app_handle, 0);
    }
}

fn reset_backend_failures(app_handle: &tauri::AppHandle) {
    if let Ok(mut guard) = BACKEND_FAILURES.lock() {
        *guard = 0;
    }
    save_failure_count(app_handle, 0);
}

fn try_call_backend(
    python: &str,
    backend_path: &std::path::Path,
    request_str: &str,
) -> Result<serde_json::Value, String> {
    let mut child = Command::new(python)
        .arg(backend_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|e| format!("Failed to start Python backend: {}", e))?;

    if let Some(ref mut stdin) = child.stdin {
        stdin
            .write_all(request_str.as_bytes())
            .map_err(|e| format!("stdin write error: {}", e))?;
        stdin
            .write_all(b"\n")
            .map_err(|e| format!("stdin newline error: {}", e))?;
        stdin.flush().map_err(|e| format!("stdin flush error: {}", e))?;
    }
    drop(child.stdin.take());

    let stdout = child.stdout.take().ok_or("no stdout")?;
    let reader = BufReader::new(stdout);
    let response_line = reader
        .lines()
        .next()
        .ok_or_else(|| "no response from backend".to_string())?
        .map_err(|e| format!("read error: {}", e))?;

    let _ = child.wait();

    let response: serde_json::Value =
        serde_json::from_str(&response_line).map_err(|e| {
            format!("JSON parse error: {}. raw: {}", e, response_line)
        })?;

    Ok(response)
}

fn format_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let dur = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    let secs = dur.as_secs();

    let mut days = (secs / 86400) as i64;
    let time_secs = secs % 86400;

    let mut year = 1970i64;
    loop {
        let days_in_year = if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) {
            366
        } else {
            365
        };
        if days < days_in_year {
            break;
        }
        days -= days_in_year;
        year += 1;
    }

    let month_days: [i64; 12] = if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut month = 1i64;
    for &md in &month_days {
        if days < md {
            break;
        }
        days -= md;
        month += 1;
    }
    let day = days + 1;

    let h = time_secs / 3600;
    let m = (time_secs % 3600) / 60;
    let s = time_secs % 60;

    format!("{}{:02}{:02}-{:02}{:02}{:02}", year, month, day, h, m, s)
}

fn cleanup_old_backups(backups_dir: &std::path::Path, keep: usize) {
    let mut files: Vec<(std::time::SystemTime, std::path::PathBuf)> =
        match std::fs::read_dir(backups_dir) {
            Ok(entries) => entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    e.path()
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|n| n.starts_with("zoobet-") && n.ends_with(".db"))
                        .unwrap_or(false)
                })
                .filter_map(|e| {
                    let modified = e.metadata().ok()?.modified().ok()?;
                    Some((modified, e.path()))
                })
                .collect(),
            Err(_) => return,
        };

    if files.len() <= keep {
        return;
    }

    files.sort_by_key(|b| std::cmp::Reverse(b.0));

    for (_time, path) in files.iter().skip(keep) {
        if let Some(stem) = path.file_stem() {
            if let Some(parent) = path.parent() {
                for suffix in &["db-wal", "db-shm"] {
                    let mut companion = parent.join(stem);
                    companion.set_extension(suffix);
                    if companion.exists() {
                        let _ = std::fs::remove_file(&companion);
                    }
                }
            }
        }
        if let Err(e) = std::fs::remove_file(path) {
            eprintln!("[rust] backup: failed to delete old backup {:?}: {}", path, e);
        } else {
            eprintln!("[rust] backup: deleted old backup {:?}", path);
        }
    }
}

fn backup_db_on_exit(app_handle: &tauri::AppHandle) {
    let backend_dir = match resolve_backend_dir(app_handle) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("[rust] backup: cannot resolve backend dir: {}", e);
            return;
        }
    };

    let backups_dir = backend_dir.join("data").join("backups");
    let timestamp = format_timestamp();
    let backup_path = backups_dir.join(format!("zoobet-{}.db", timestamp));

    let python = find_python();
    let backend_path = match resolve_backend_path(app_handle) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[rust] backup: cannot resolve backend path: {}", e);
            return;
        }
    };

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "settings.backup",
        "params": {"target_path": backup_path.to_string_lossy()},
    });
    let request_str = match serde_json::to_string(&request) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[rust] backup: json serialize error: {}", e);
            return;
        }
    };

    let _guard = match PYTHON_LOCK.lock() {
        Ok(g) => g,
        Err(e) => {
            eprintln!("[rust] backup: lock error: {}", e);
            return;
        }
    };

    match try_call_backend(python, &backend_path, &request_str) {
        Ok(response) => {
            if let Some(error) = response.get("error") {
                let err_msg = error
                    .get("message")
                    .and_then(|m| m.as_str())
                    .unwrap_or("unknown backend error");
                eprintln!("[rust] backup: backend error: {}", err_msg);
            } else {
                eprintln!("[rust] backup: saved to {:?}", backup_path);
            }
        }
        Err(e) => {
            eprintln!("[rust] backup: call failed: {}", e);
        }
    }

    cleanup_old_backups(&backups_dir, 5);
}

#[tauri::command]
fn call_backend(
    app_handle: tauri::AppHandle,
    method: String,
    params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let backend_path = resolve_backend_path(&app_handle)?;
    let python = find_python();

    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params,
    });
    let request_str = serde_json::to_string(&request).map_err(|e| e.to_string())?;

    let _guard = PYTHON_LOCK.lock().map_err(|e| format!("lock error: {}", e))?;

    let mut last_err = String::new();
    for attempt in 0..=DEFAULT_MAX_RETRIES {
        if attempt > 0 {
            eprintln!(
                "[rust] Backend retry attempt {}/{} after {}ms",
                attempt, DEFAULT_MAX_RETRIES, DEFAULT_RETRY_DELAY_MS
            );
            std::thread::sleep(std::time::Duration::from_millis(DEFAULT_RETRY_DELAY_MS));
        }

        match try_call_backend(python, &backend_path, &request_str) {
            Ok(response) => {
                if let Some(error) = response.get("error") {
                    let err_msg = error
                        .get("message")
                        .and_then(|m| m.as_str())
                        .unwrap_or("unknown backend error");
                    eprintln!("[rust] Backend returned business error (not retrying): {}", err_msg);
                    return Err(err_msg.to_string());
                }
                reset_backend_failures(&app_handle);
                return Ok(response
                    .get("result")
                    .cloned()
                    .unwrap_or(serde_json::Value::Null));
            }
            Err(e) => {
                eprintln!(
                    "[rust] Backend call failed (attempt {}/{}): {}",
                    attempt + 1,
                    DEFAULT_MAX_RETRIES + 1,
                    e
                );
                last_err = e;
            }
        }
    }

    eprintln!("[rust] All {} retries exhausted", DEFAULT_MAX_RETRIES + 1);
    track_backend_failure(&app_handle);
    Err(last_err)
}

#[tauri::command]
fn scan_library(
    app_handle: tauri::AppHandle,
    library_id: i64,
    library_path: String,
) -> Result<serde_json::Value, String> {
    let backend_dir = resolve_backend_dir(&app_handle)?;
    let python = find_python();
    let scan_script = backend_dir.join("services").join("scan_service.py");

    if !scan_script.exists() {
        return Err(format!(
            "scan_service.py not found at {:?}",
            scan_script
        ));
    }

    let _guard = PYTHON_LOCK.lock().map_err(|e| format!("lock error: {}", e))?;

    let mut child = Command::new(python)
        .arg(&scan_script)
        .arg("--library-id")
        .arg(library_id.to_string())
        .arg("--path")
        .arg(&library_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|e| format!("Failed to start scan process: {}", e))?;

    let stdout = child.stdout.take().ok_or("no stdout from scan process")?;
    *SCAN_CHILD.lock().map_err(|e| e.to_string())? = Some(child);

    let reader = BufReader::new(stdout);
    let window = app_handle
        .get_webview_window("main")
        .ok_or("main window not found")?;

    let mut last_result: Option<serde_json::Value> = None;

    for line in reader.lines() {
        let line = line.map_err(|e| format!("scan read error: {}", e))?;
        let payload: serde_json::Value = serde_json::from_str(&line).map_err(|e| {
            format!("scan JSON parse error: {}. raw: {}", e, line)
        })?;

        let ptype = payload
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if ptype == "progress" {
            let _ = window.emit("scan-progress", &payload);
        } else if ptype == "result" {
            last_result = Some(payload);
            break;
        }
    }

    if let Ok(mut guard) = SCAN_CHILD.lock() {
        if let Some(ref mut c) = *guard {
            let _ = c.wait();
        }
        *guard = None;
    }

    match last_result {
        Some(result) => Ok(result),
        None => Err("Scan process ended without result".to_string()),
    }
}

#[tauri::command]
fn cancel_scan() -> Result<serde_json::Value, String> {
    let mut guard = SCAN_CHILD.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut child) = *guard {
        child
            .kill()
            .map_err(|e| format!("Failed to cancel scan: {}", e))?;
        *guard = None;
        Ok(serde_json::json!({"cancelled": true}))
    } else {
        Ok(serde_json::json!({"cancelled": false, "reason": "no active scan"}))
    }
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    let mut file = std::fs::File::create(&path)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    file.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

#[tauri::command]
fn check_path(path: String) -> Result<serde_json::Value, String> {
    let p = std::path::Path::new(&path);
    Ok(serde_json::json!({ "exists": p.exists() }))
}

#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err(format!("File not found: {}", path));
    }
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open: {}", e))?;
    Ok(())
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    let target = if p.is_file() { p.parent().unwrap_or(p) } else { p };
    if !target.exists() {
        return Err(format!("Folder not found: {}", target.display()));
    }
    std::process::Command::new("explorer")
        .arg(target)
        .spawn()
        .map_err(|e| format!("Failed to open: {}", e))?;
    Ok(())
}

fn stop_watcher_internal() {
    // Drop the debounce sender, which signals the debounce thread to exit
    if let Ok(mut tx_guard) = DEBOUNCE_TX.lock() {
        *tx_guard = None;
    }
    // Drop the watcher
    if let Ok(mut w_guard) = FOLDER_WATCHER.lock() {
        *w_guard = None;
    }
    if let Ok(mut p_guard) = WATCHED_PATHS.lock() {
        p_guard.clear();
    }
}

#[tauri::command]
fn start_folder_watch(
    app_handle: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<serde_json::Value, String> {
    stop_watcher_internal();

    if paths.is_empty() {
        let _ = app_handle.emit("watch-status-changed", serde_json::json!({
            "active": false,
            "paths": [],
        }));
        return Ok(serde_json::json!({"status": "no_paths"}));
    }

    // Filter to existing directories
    let valid_paths: Vec<String> = paths
        .iter()
        .filter(|p| std::path::Path::new(p).is_dir())
        .cloned()
        .collect();

    if valid_paths.is_empty() {
        let _ = app_handle.emit("watch-status-changed", serde_json::json!({
            "active": false,
            "paths": [],
        }));
        return Ok(serde_json::json!({"status": "no_valid_paths"}));
    }

    let (tx, rx) = mpsc::channel::<()>();
    let app_handle_clone = app_handle.clone();

    // Debounce thread: wait for 5s of quiet, then emit event
    std::thread::spawn(move || {
        loop {
            // Wait for first change notification
            match rx.recv() {
                Ok(()) => {
                    // Debounce loop: reset timer on each new change
                    loop {
                        match rx.recv_timeout(Duration::from_secs(5)) {
                            Ok(()) => continue, // Another change — reset debounce
                            Err(mpsc::RecvTimeoutError::Timeout) => {
                                // 5 seconds of quiet — fire event
                                let _ = app_handle_clone.emit(
                                    "file-change-detected",
                                    serde_json::json!({}),
                                );
                                break;
                            }
                            Err(mpsc::RecvTimeoutError::Disconnected) => return,
                        }
                    }
                }
                Err(_) => return, // Channel closed
            }
        }
    });

    // Create watcher with callback that feeds the debounce channel
    let tx_clone = tx.clone();
    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        match res {
            Ok(event) => {
                // Only react to file creation and content modification
                let relevant = matches!(
                    event.kind,
                    EventKind::Create(_) | EventKind::Modify(_)
                );
                if relevant {
                    // Non-blocking send — if channel is full or closed, just skip
                    let _ = tx_clone.send(());
                }
            }
            Err(e) => {
                eprintln!("[rust] folder watch error: {:?}", e);
            }
        }
    })
    .map_err(|e| format!("Failed to create folder watcher: {}", e))?;

    // Watch each library path recursively
    for path in &valid_paths {
        watcher
            .watch(std::path::Path::new(path), RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch {}: {}", path, e))?;
    }

    *FOLDER_WATCHER.lock().map_err(|e| e.to_string())? = Some(watcher);
    *DEBOUNCE_TX.lock().map_err(|e| e.to_string())? = Some(tx);
    *WATCHED_PATHS.lock().map_err(|e| e.to_string())? = valid_paths.clone();

    let _ = app_handle.emit("watch-status-changed", serde_json::json!({
        "active": true,
        "paths": valid_paths,
    }));

    Ok(serde_json::json!({"status": "started", "paths": valid_paths}))
}

#[tauri::command]
fn stop_folder_watch(app_handle: tauri::AppHandle) -> Result<serde_json::Value, String> {
    stop_watcher_internal();

    let _ = app_handle.emit("watch-status-changed", serde_json::json!({
        "active": false,
        "paths": [],
    }));

    Ok(serde_json::json!({"status": "stopped"}))
}

#[tauri::command]
fn find_prt_files_batch(dirs: Vec<String>) -> Result<serde_json::Value, String> {
    let mut result: HashMap<String, Vec<String>> = HashMap::new();
    for dir in &dirs {
        let path = std::path::Path::new(dir);
        if !path.is_dir() {
            continue;
        }
        let mut prt_files: Vec<String> = Vec::new();
        match std::fs::read_dir(path) {
            Ok(entries) => {
                for entry in entries.flatten() {
                    let entry_path = entry.path();
                    if entry_path.extension().map(|e| e.to_ascii_lowercase()) == Some("prt".into()) {
                        if let Some(p) = entry_path.to_str() {
                            prt_files.push(p.to_string());
                        }
                    }
                }
            }
            Err(_) => continue,
        }
        if !prt_files.is_empty() {
            result.insert(dir.clone(), prt_files);
        }
    }
    Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
}

#[tauri::command]
fn get_watch_status() -> Result<serde_json::Value, String> {
    let active = DEBOUNCE_TX.lock().map_err(|e| e.to_string())?.is_some();
    let paths = WATCHED_PATHS.lock().map_err(|e| e.to_string())?.clone();
    Ok(serde_json::json!({"active": active, "paths": paths}))
}

fn main() {
    panic::set_hook(Box::new(|info| {
        let msg = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            format!("{}", info)
        };
        let location = info.location().map(|l| format!("{}:{}", l.file(), l.line())).unwrap_or_default();
        spawn_error_report("panic", &format!("{} at {}", msg, location));
    }));

    let startup_args = parse_startup_args();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(startup_args))
        .invoke_handler(tauri::generate_handler![
            get_startup_args,
            call_backend,
            scan_library,
            cancel_scan,
            check_path,
            open_file,
            open_folder,
            write_text_file,
            save_window_state,
            load_window_state,
            find_prt_files_batch,
            start_folder_watch,
            stop_folder_watch,
            get_watch_status,
            export::export_zip,
            export::export_pdf,
            export::copy_image_to_clipboard,
            export::open_file_manager
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // Restore persisted backend failure count from disk
            let saved_failures = load_failure_count(app.handle());
            if saved_failures > 0 {
                if let Ok(mut guard) = BACKEND_FAILURES.lock() {
                    *guard = saved_failures;
                }
            }

            // Restore saved window state
            let saved = read_window_states(app.handle());
            if let Some(state) = saved.get("main") {
                let state = state.clone();
                if state.maximized {
                    let _ = window.maximize();
                } else {
                    let min_w: u32 = 1024;
                    let min_h: u32 = 680;
                    let width = if state.width < min_w { min_w } else { state.width };
                    let height = if state.height < min_h { min_h } else { state.height };

                    if is_position_on_screen(&window, state.x, state.y, width, height) {
                        let _ = window.set_position(tauri::LogicalPosition::new(state.x, state.y));
                        let _ = window.set_size(tauri::LogicalSize::new(width, height));
                    }
                }
            }

            // Save window state on close, minimize to tray instead of exiting
            let app_handle = app.handle().clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    if let Some(w) = app_handle.get_webview_window("main") {
                        if let Ok(pos) = w.outer_position() {
                            if let Ok(size) = w.outer_size() {
                                let maximized = w.is_maximized().unwrap_or(false);
                                let mut states = read_window_states(&app_handle);
                                states.insert(
                                    "main".to_string(),
                                    WindowState {
                                        x: pos.x,
                                        y: pos.y,
                                        width: size.width,
                                        height: size.height,
                                        maximized,
                                    },
                                );
                                let _ = write_window_states(&app_handle, &states);
                            }
                        }
                    }
                    api.prevent_close();
                    if let Some(w) = app_handle.get_webview_window("main") {
                        let _ = w.hide();
                    }
                }
            });

            // Set up system tray icon
            let png_bytes = include_bytes!("../icons/32x32.png");
            let img = image::load_from_memory(png_bytes)
                .expect("Failed to decode tray icon PNG");
            let rgba = img.into_rgba8();
            let (w, h) = rgba.dimensions();
            let tray_image = tauri::image::Image::new_owned(rgba.into_raw(), w, h);

            let show_item = tauri::menu::MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let quit_item = tauri::menu::MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let tray_menu = tauri::menu::MenuBuilder::new(app)
                .item(&show_item)
                .item(&quit_item)
                .build()?;

            let tray = tauri::tray::TrayIconBuilder::new()
                .icon(tray_image)
                .menu(&tray_menu)
                .on_menu_event(|app_handle, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(w) = app_handle.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "quit" => {
                            backup_db_on_exit(app_handle);
                            app_handle.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray_icon, event| {
                    if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
                        if let Some(w) = tray_icon.app_handle().get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;
            app.manage(tray);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
