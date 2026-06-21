#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::Emitter;
use tauri::Manager;

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

    // Acquire Python lock to prevent concurrent Python calls
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

    // Clear scan child
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            call_backend,
            scan_library,
            cancel_scan
        ])
        .setup(|app| {
            let _window = app.get_webview_window("main").unwrap();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
