use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::{Emitter, Manager, RunEvent};

#[derive(Default)]
struct PendingOpen(Mutex<Vec<String>>);

#[derive(Default)]
struct FrontendReady(AtomicBool);

#[tauri::command]
fn frontend_ready(
    app: tauri::AppHandle,
    pending: tauri::State<PendingOpen>,
    ready: tauri::State<FrontendReady>,
) {
    ready.0.store(true, Ordering::SeqCst);
    let files = std::mem::take(&mut *pending.0.lock().unwrap());
    if !files.is_empty() {
        let _ = app.emit("open-file", files);
    }
}

fn file_paths(urls: Vec<tauri::Url>) -> Vec<String> {
    urls.into_iter()
        .filter_map(|url| url.to_file_path().ok())
        .map(|path| path.to_string_lossy().to_string())
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(PendingOpen::default())
        .manage(FrontendReady::default())
        .invoke_handler(tauri::generate_handler![frontend_ready])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Opened { urls } = event {
                let files = file_paths(urls);
                if files.is_empty() {
                    return;
                }
                let ready = app.state::<FrontendReady>();
                if ready.0.load(Ordering::SeqCst) {
                    let _ = app.emit("open-file", files);
                } else {
                    app.state::<PendingOpen>().0.lock().unwrap().extend(files);
                }
            }
        });
}
