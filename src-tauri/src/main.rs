#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::Emitter;
use tauri::Manager;

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

    let mut child = Command::new(python)
        .arg(&backend_path)
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
        .ok_or("no response from backend")?
        .map_err(|e| format!("read error: {}", e))?;

    let _ = child.wait();

    let response: serde_json::Value =
        serde_json::from_str(&response_line).map_err(|e| {
            format!("JSON parse error: {}. raw: {}", e, response_line)
        })?;

    if let Some(error) = response.get("error") {
        return Err(error
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("unknown backend error")
            .to_string());
    }

    Ok(response
        .get("result")
        .cloned()
        .unwrap_or(serde_json::Value::Null))
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            call_backend,
            scan_library,
            cancel_scan,
            open_file,
            open_folder,
            save_window_state,
            load_window_state
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

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

            // Save window state on close
            let app_handle = app.handle().clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { .. } = event {
                    if let Some(w) = app_handle.get_webview_window("main") {
                        if let Ok(pos) = w.outer_position() {
                            if let Ok(size) = w.outer_size() {
                                let maximized = w.is_maximized().unwrap_or(false);
                                let mut states = read_window_states(&app_handle);
                                states.insert(
                                    "main".to_string(),
                                    WindowState {
                                        x: pos.x as i32,
                                        y: pos.y as i32,
                                        width: size.width,
                                        height: size.height,
                                        maximized,
                                    },
                                );
                                let _ = write_window_states(&app_handle, &states);
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
