use std::fs::{self, File};
use std::io::Write;
use std::path::Path;

use serde::Deserialize;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Deserialize)]
pub struct ExportItem {
    pub image_path: String,
    pub img_id: String,
    pub origin_path: String,
    pub similarity: f64,
    pub source_type: String,
    #[serde(default)]
    pub sheet_name: Option<String>,
    #[serde(default)]
    pub row_number: Option<i64>,
    #[serde(default)]
    pub ug_ref: Option<String>,
    #[serde(default)]
    pub ocr_text: Option<String>,
    #[serde(default)]
    pub width: Option<i64>,
    #[serde(default)]
    pub height: Option<i64>,
    #[serde(default)]
    pub format: Option<String>,
    #[serde(default)]
    pub size_bytes: Option<i64>,
}

#[tauri::command]
pub fn export_zip(
    app_handle: AppHandle,
    output_path: String,
    items: Vec<ExportItem>,
) -> Result<String, String> {
    let total = items.len();
    let _ = app_handle.emit(
        "export-progress",
        serde_json::json!({
            "task": "zip",
            "current": 0,
            "total": total,
            "message": "Starting ZIP export...",
        }),
    );

    let file = File::create(&output_path)
        .map_err(|e| format!("Cannot create ZIP file: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options: zip::write::FileOptions<'_, ()> = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // Write summary.json
    let summary = serde_json::json!({
        "exported_at": chrono_like_now(),
        "count": total,
        "items": items.iter().map(|item| {
            serde_json::json!({
                "img_id": item.img_id,
                "image_path": item.image_path,
                "origin_path": item.origin_path,
                "similarity": item.similarity,
                "source_type": item.source_type,
                "sheet_name": item.sheet_name,
                "row_number": item.row_number,
                "ug_ref": item.ug_ref,
                "format": item.format,
                "width": item.width,
                "height": item.height,
            })
        }).collect::<Vec<_>>(),
    });

    zip.start_file("summary.json", options)
        .map_err(|e| format!("ZIP error: {}", e))?;
    let summary_bytes = serde_json::to_string_pretty(&summary)
        .map_err(|e| format!("JSON error: {}", e))?;
    zip.write_all(summary_bytes.as_bytes())
        .map_err(|e| format!("ZIP write error: {}", e))?;

    // Add each image
    for (i, item) in items.iter().enumerate() {
        let filename = extract_filename(&item.image_path);
        let entry_name = format!("images/{}", filename);

        zip.start_file(&entry_name, options)
            .map_err(|e| format!("ZIP error for {}: {}", filename, e))?;

        match fs::read(&item.image_path) {
            Ok(data) => {
                zip.write_all(&data)
                    .map_err(|e| format!("ZIP write error for {}: {}", filename, e))?;
            }
            Err(e) => {
                let msg = format!("[read error: {}]", e);
                zip.write_all(msg.as_bytes())
                    .map_err(|e2| format!("ZIP write error: {}", e2))?;
            }
        }

        let _ = app_handle.emit(
            "export-progress",
            serde_json::json!({
                "task": "zip",
                "current": i + 1,
                "total": total,
                "message": format!("Packing {} ({}/{})", filename, i + 1, total),
            }),
        );
    }

    zip.finish()
        .map_err(|e| format!("ZIP finalize error: {}", e))?;

    let _ = app_handle.emit(
        "export-progress",
        serde_json::json!({
            "task": "zip",
            "current": total,
            "total": total,
            "message": "ZIP export complete",
        }),
    );

    Ok(output_path)
}

#[tauri::command]
pub fn export_pdf(
    app_handle: AppHandle,
    output_path: String,
    items: Vec<ExportItem>,
) -> Result<String, String> {
    let total = items.len();
    let _ = app_handle.emit(
        "export-progress",
        serde_json::json!({
            "task": "pdf",
            "current": 0,
            "total": total,
            "message": "Starting PDF export...",
        }),
    );

    // Load a system font for PDF rendering
    let font_path = find_system_font();
    let font_bytes = std::fs::read(&font_path)
        .map_err(|e| format!("Cannot read font file {:?}: {}", font_path, e))?;
    let font_data = genpdf::fonts::FontData::new(font_bytes, None)
        .map_err(|e| format!("Font data error: {}", e))?;
    let font_data_bold = genpdf::fonts::FontData::new(
        std::fs::read(&font_path).map_err(|e| format!("Cannot re-read font: {}", e))?,
        None,
    ).map_err(|e| format!("Font data error: {}", e))?;
    let font_data_italic = genpdf::fonts::FontData::new(
        std::fs::read(&font_path).map_err(|e| format!("Cannot re-read font: {}", e))?,
        None,
    ).map_err(|e| format!("Font data error: {}", e))?;
    let font_data_bi = genpdf::fonts::FontData::new(
        std::fs::read(&font_path).map_err(|e| format!("Cannot re-read font: {}", e))?,
        None,
    ).map_err(|e| format!("Font data error: {}", e))?;
    let font_family = genpdf::fonts::FontFamily {
        regular: font_data,
        bold: font_data_bold,
        italic: font_data_italic,
        bold_italic: font_data_bi,
    };

    let mut doc = genpdf::Document::new(font_family);
    doc.set_title("ZOOBET Search Results Export");

    use genpdf::Element;
    use genpdf::elements::{Break, Image, Paragraph};

    // Title
    doc.push(Paragraph::new("ZOOBET Search Results Export")
        .styled(genpdf::style::Style::new().bold()));
    doc.push(Paragraph::new(format!("Exported: {}", chrono_like_now()))
        .styled(genpdf::style::Style::new()));
    doc.push(Paragraph::new(format!("Total results: {}", total))
        .styled(genpdf::style::Style::new()));
    doc.push(Break::new(0.3));
    doc.push(Paragraph::new("────────────────────────────────────────")
        .styled(genpdf::style::Style::new()));
    doc.push(Break::new(0.3));

    for (i, item) in items.iter().enumerate() {
        // Item header
        doc.push(Paragraph::new(format!(
            "#{}  {}  — Similarity: {:.1}%",
            i + 1,
            item.img_id,
            item.similarity * 100.0,
        )).styled(genpdf::style::Style::new().bold()));

        // File path
        doc.push(Paragraph::new(format!("Path: {}", item.image_path))
            .styled(genpdf::style::Style::new()));

        // Source info
        let mut source_info = format!("Source: {}", item.source_type);
        if let Some(ref sheet) = item.sheet_name {
            source_info.push_str(&format!("  |  Sheet: {}", sheet));
        }
        if let Some(row) = item.row_number {
            source_info.push_str(&format!("  |  Row: {}", row));
        }
        if let Some(ref ug) = item.ug_ref {
            source_info.push_str(&format!("  |  UG: {}", ug));
        }
        doc.push(Paragraph::new(source_info)
            .styled(genpdf::style::Style::new()));

        // Dimensions and format
        if item.width.is_some() || item.format.is_some() || item.size_bytes.is_some() {
            let mut dims = String::new();
            if let (Some(w), Some(h)) = (item.width, item.height) {
                dims.push_str(&format!("{}x{}", w, h));
            }
            if let Some(ref fmt) = item.format {
                if !dims.is_empty() { dims.push_str("  |  "); }
                dims.push_str(fmt);
            }
            if let Some(size) = item.size_bytes {
                if !dims.is_empty() { dims.push_str("  |  "); }
                dims.push_str(&format_size(size));
            }
            doc.push(Paragraph::new(dims)
                .styled(genpdf::style::Style::new()));
        }

        // Try to add thumbnail
        let thumb_path = Path::new(&item.image_path);
        if thumb_path.exists() {
            if let Ok(img_element) = Image::from_path(&item.image_path) {
                doc.push(img_element);
            }
        }

        doc.push(Break::new(0.4));

        let _ = app_handle.emit(
            "export-progress",
            serde_json::json!({
                "task": "pdf",
                "current": i + 1,
                "total": total,
                "message": format!("Generating ({}/{})", i + 1, total),
            }),
        );
    }

    // Render to file
    doc.render_to_file(&output_path)
        .map_err(|e| format!("PDF render error: {}", e))?;

    let _ = app_handle.emit(
        "export-progress",
        serde_json::json!({
            "task": "pdf",
            "current": total,
            "total": total,
            "message": "PDF export complete",
        }),
    );

    Ok(output_path)
}

#[tauri::command]
pub fn copy_image_to_clipboard(image_path: String) -> Result<(), String> {
    let img = image::open(&image_path)
        .map_err(|e| format!("Cannot open image: {}", e))?;
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();

    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| format!("Cannot access clipboard: {}", e))?;

    let data = arboard::ImageData {
        width: w as usize,
        height: h as usize,
        bytes: std::borrow::Cow::Owned(rgba.into_raw()),
    };
    clipboard.set_image(data)
        .map_err(|e| format!("Failed to copy image to clipboard: {}", e))
}

#[tauri::command]
pub fn open_file_manager(file_path: String) -> Result<(), String> {
    let p = Path::new(&file_path);
    let target = if p.is_file() {
        p.parent().unwrap_or(p)
    } else {
        p
    };
    if !target.exists() {
        return Err(format!("Path not found: {}", target.display()));
    }
    std::process::Command::new("explorer")
        .arg(target)
        .spawn()
        .map_err(|e| format!("Failed to open file manager: {}", e))?;
    Ok(())
}

fn extract_filename(path: &str) -> String {
    path.replace('\\', "/")
        .rsplit('/')
        .next()
        .unwrap_or(path)
        .to_string()
}

fn format_size(bytes: i64) -> String {
    if bytes < 1024 {
        format!("{}B", bytes)
    } else if bytes < 1024 * 1024 {
        format!("{}KB", bytes / 1024)
    } else if bytes < 1024 * 1024 * 1024 {
        format!("{:.1}MB", bytes as f64 / (1024.0 * 1024.0))
    } else {
        format!("{:.2}GB", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
    }
}

fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let dur = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
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

    format!(
        "{}-{:02}-{:02} {:02}:{:02}:{:02}",
        year, month, day, h, m, s
    )
}

fn find_system_font() -> &'static str {
    // Try common Windows system font locations
    let candidates = [
        "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\segoeui.ttf",
        "C:\\Windows\\Fonts\\calibri.ttf",
        "C:\\Windows\\Fonts\\consola.ttf",
    ];
    for path in &candidates {
        if Path::new(path).exists() {
            return path;
        }
    }
    // Fallback — should not happen on Windows
    "C:\\Windows\\Fonts\\arial.ttf"
}
