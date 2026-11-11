use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{Emitter, Manager, RunEvent};

/// Folders that never hold notes and are never worth waking the UI for.
const SKIP_DIRS: [&str; 4] = ["Library", "node_modules", ".git", ".Trash"];

/// How long after our own write a file event is taken to be that write.
const SELF_WRITE_WINDOW: Duration = Duration::from_millis(1500);

/// Paths this app wrote itself, so the watcher can tell an agent's edit from
/// our own save.
#[derive(Default)]
struct SelfWrites(Arc<Mutex<HashMap<String, Instant>>>);

#[derive(Default)]
struct WatchState(Mutex<Option<RecommendedWatcher>>);

fn note_self_write(writes: &SelfWrites, path: &str) {
    writes
        .0
        .lock()
        .unwrap()
        .insert(path.to_string(), Instant::now());
}

/// Write to a temporary file beside the target, then rename over it, so a
/// crash mid-write can never leave a half-written note.
#[tauri::command]
fn write_file_atomic(
    path: String,
    contents: String,
    writes: tauri::State<SelfWrites>,
) -> Result<(), String> {
    let target = Path::new(&path);
    let name = target
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("invalid path")?;
    let tmp = target.with_file_name(format!(".{name}.tmp-brief"));
    fs::write(&tmp, contents).map_err(|e| e.to_string())?;
    note_self_write(&writes, &path);
    fs::rename(&tmp, target).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        e.to_string()
    })
}

/// Move a file or folder to the system Trash. Never deletes permanently.
#[tauri::command]
fn trash_path(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_dir(path: String) -> Result<(), String> {
    if Path::new(&path).exists() {
        return Err("already exists".into());
    }
    fs::create_dir(&path).map_err(|e| e.to_string())
}

/// Save a pasted or dropped image into an `assets` folder beside the note and
/// return its path relative to the note.
#[tauri::command]
fn save_asset(
    file_path: String,
    bytes: Vec<u8>,
    ext: String,
    writes: tauri::State<SelfWrites>,
) -> Result<String, String> {
    let ext: String = ext
        .trim_start_matches('.')
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect();
    let ext = if ext.is_empty() { "png".to_string() } else { ext };
    let dir = Path::new(&file_path)
        .parent()
        .ok_or("invalid path")?
        .join("assets");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let mut name = format!("image-{stamp}.{ext}");
    let mut n = 2;
    while dir.join(&name).exists() {
        name = format!("image-{stamp}-{n}.{ext}");
        n += 1;
    }
    let full = dir.join(&name);
    fs::write(&full, bytes).map_err(|e| e.to_string())?;
    note_self_write(&writes, &full.to_string_lossy());
    Ok(format!("assets/{name}"))
}

fn worth_reporting(path: &Path) -> bool {
    for part in path.components() {
        if let Some(name) = part.as_os_str().to_str() {
            if SKIP_DIRS.contains(&name) {
                return false;
            }
        }
    }
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) => ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown"),
        // No extension: probably a folder appearing, going or being renamed.
        None => true,
    }
}

/// Watch `root` and emit `fs-change` with the changed paths once things go
/// quiet. Replaces any earlier watch.
#[tauri::command]
fn start_watch(
    app: tauri::AppHandle,
    root: String,
    state: tauri::State<WatchState>,
    writes: tauri::State<SelfWrites>,
) -> Result<(), String> {
    let (tx, rx) = mpsc::channel::<notify::Result<notify::Event>>();
    let mut watcher = notify::recommended_watcher(tx).map_err(|e| e.to_string())?;
    watcher
        .watch(Path::new(&root), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;
    // Dropping the old watcher closes its channel, which ends its thread.
    *state.0.lock().unwrap() = Some(watcher);

    let self_writes = writes.0.clone();
    std::thread::spawn(move || {
        let mut pending: HashSet<String> = HashSet::new();
        loop {
            let wait = if pending.is_empty() {
                Duration::from_secs(3600)
            } else {
                Duration::from_millis(300)
            };
            match rx.recv_timeout(wait) {
                Ok(Ok(event)) => {
                    if matches!(
                        event.kind,
                        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
                    ) {
                        for path in event.paths {
                            if worth_reporting(&path) {
                                pending.insert(path.to_string_lossy().to_string());
                            }
                        }
                    }
                }
                Ok(Err(_)) => {}
                Err(RecvTimeoutError::Timeout) => {
                    let mut own = self_writes.lock().unwrap();
                    own.retain(|_, at| at.elapsed() < SELF_WRITE_WINDOW);
                    let changed: Vec<String> = pending
                        .drain()
                        .filter(|p| !own.contains_key(p))
                        .collect();
                    drop(own);
                    if !changed.is_empty() {
                        let _ = app.emit("fs-change", changed);
                    }
                }
                Err(RecvTimeoutError::Disconnected) => break,
            }
        }
    });
    Ok(())
}

#[tauri::command]
fn stop_watch(state: tauri::State<WatchState>) {
    *state.0.lock().unwrap() = None;
}

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
        .manage(SelfWrites::default())
        .manage(WatchState::default())
        .invoke_handler(tauri::generate_handler![
            frontend_ready,
            write_file_atomic,
            trash_path,
            create_dir,
            save_asset,
            start_watch,
            stop_watch
        ])
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
