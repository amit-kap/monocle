//! The sidebar's tree, read natively in one pass.
//!
//! Every folder is listed (empty ones too, so a folder made in Finder or in the
//! app shows straight away), but the only files are markdown. Each folder says
//! whether any note sits inside it at any depth, so the sidebar can dim the
//! ones that hold none.

use std::fs;
use std::path::Path;

use serde::Serialize;

/// Folders that never hold the user's notes: system data, dependencies, build
/// output, caches. Skipped wherever they appear, hidden files on or off.
pub const SKIP_DIRS: &[&str] = &[
    "Library",
    "node_modules",
    ".git",
    ".Trash",
    "dist",
    "build",
    "target",
    ".next",
    ".cache",
    ".npm",
    ".cargo",
    ".rustup",
    ".pnpm-store",
    ".gradle",
    ".m2",
    ".venv",
    "venv",
    "__pycache__",
    "Pods",
    "DerivedData",
];

/// macOS packages look like folders but are single documents (an app, the
/// Photos library). Walking into them is slow and never finds notes.
const PACKAGE_EXTS: &[&str] = &[
    "app",
    "photoslibrary",
    "musiclibrary",
    "tvlibrary",
    "bundle",
    "framework",
    "xcodeproj",
    "xcworkspace",
    "xcassets",
    "pkg",
    "plugin",
    "kext",
];

/// Hidden folders that coding agents keep their markdown in. They show even
/// with hidden files off; every other dot-folder needs the toggle.
pub const AGENT_DIRS: &[&str] = &[
    ".claude",
    ".codex",
    ".cursor",
    ".github",
    ".agents",
    ".gemini",
    ".windsurf",
    ".continue",
    ".aider",
];

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Node {
    pub name: String,
    pub path: String,
    pub kind: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<Node>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_notes: Option<bool>,
}

pub fn is_markdown(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".md") || lower.ends_with(".markdown")
}

fn is_package(name: &str) -> bool {
    match name.rsplit_once('.') {
        Some((stem, ext)) if !stem.is_empty() => {
            PACKAGE_EXTS.iter().any(|p| p.eq_ignore_ascii_case(ext))
        }
        _ => false,
    }
}

/// Whether a folder with this name is skipped entirely.
pub fn skip_dir(name: &str, show_hidden: bool) -> bool {
    if SKIP_DIRS.contains(&name) || is_package(name) {
        return true;
    }
    name.starts_with('.') && !show_hidden && !AGENT_DIRS.contains(&name)
}

fn join(dir: &str, name: &str) -> String {
    if dir.ends_with('/') {
        format!("{dir}{name}")
    } else {
        format!("{dir}/{name}")
    }
}

/// Files first, then folders, each A to Z ignoring case.
fn sort(nodes: &mut [Node]) {
    nodes.sort_by(|a, b| {
        (a.kind != "file")
            .cmp(&(b.kind != "file"))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
            .then_with(|| a.name.cmp(&b.name))
    });
}

/// The contents of `dir`. An unreadable subfolder is listed as empty rather
/// than failing the whole scan; only the top folder's error is returned.
pub fn scan(dir: &str, show_hidden: bool) -> Result<Vec<Node>, String> {
    let entries = fs::read_dir(Path::new(dir)).map_err(|e| e.to_string())?;
    let mut nodes = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        // Symlinks are skipped: they can loop, and the target shows where it lives.
        let Ok(kind) = entry.file_type() else { continue };
        if kind.is_symlink() {
            continue;
        }
        let path = join(dir, &name);
        if kind.is_dir() {
            if skip_dir(&name, show_hidden) {
                continue;
            }
            let children = scan(&path, show_hidden).unwrap_or_default();
            let has_notes = children
                .iter()
                .any(|c| c.kind == "file" || c.has_notes == Some(true));
            nodes.push(Node {
                name,
                path,
                kind: "dir",
                children: Some(children),
                size: None,
                has_notes: Some(has_notes),
            });
        } else if kind.is_file() && is_markdown(&name) {
            if name.starts_with('.') && !show_hidden {
                continue;
            }
            let size = entry.metadata().ok().map(|m| m.len());
            nodes.push(Node {
                name,
                path,
                kind: "file",
                children: None,
                size,
                has_notes: None,
            });
        }
    }
    sort(&mut nodes);
    Ok(nodes)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("monocle-tree-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn names(nodes: &[Node]) -> Vec<&str> {
        nodes.iter().map(|n| n.name.as_str()).collect()
    }

    #[test]
    fn lists_every_folder_but_only_markdown_files() {
        let dir = scratch("basic");
        fs::write(dir.join("b.md"), "x").unwrap();
        fs::write(dir.join("A.markdown"), "x").unwrap();
        fs::write(dir.join("photo.png"), "x").unwrap();
        fs::create_dir(dir.join("empty")).unwrap();
        fs::create_dir_all(dir.join("deep/er")).unwrap();
        fs::write(dir.join("deep/er/n.md"), "x").unwrap();
        fs::create_dir(dir.join("images")).unwrap();
        fs::write(dir.join("images/i.png"), "x").unwrap();

        let nodes = scan(dir.to_str().unwrap(), false).unwrap();
        assert_eq!(names(&nodes), vec!["A.markdown", "b.md", "deep", "empty", "images"]);
        let deep = &nodes[2];
        assert_eq!(deep.has_notes, Some(true));
        assert_eq!(nodes[3].has_notes, Some(false));
        assert_eq!(nodes[4].has_notes, Some(false));
        assert_eq!(nodes[4].children.as_ref().unwrap().len(), 0);
        assert_eq!(nodes[1].size, Some(1));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn hidden_folders_show_only_for_agents_unless_the_toggle_is_on() {
        let dir = scratch("hidden");
        fs::create_dir(dir.join(".claude")).unwrap();
        fs::write(dir.join(".claude/CLAUDE.md"), "x").unwrap();
        fs::create_dir(dir.join(".secret")).unwrap();
        fs::write(dir.join(".secret/s.md"), "x").unwrap();
        fs::write(dir.join(".hidden.md"), "x").unwrap();
        fs::create_dir(dir.join("node_modules")).unwrap();
        fs::write(dir.join("node_modules/r.md"), "x").unwrap();
        fs::create_dir(dir.join("Photos Library.photoslibrary")).unwrap();

        let root = dir.to_str().unwrap();
        assert_eq!(names(&scan(root, false).unwrap()), vec![".claude"]);
        assert_eq!(
            names(&scan(root, true).unwrap()),
            vec![".hidden.md", ".claude", ".secret"]
        );
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_missing_top_folder_is_an_error() {
        assert!(scan("/definitely/not/here", false).is_err());
    }
}

/// `cargo test --release scan_home -- --ignored --nocapture`: how long the real
/// home folder takes, and how big the tree is.
#[cfg(test)]
mod bench {
    use super::*;

    fn count(nodes: &[Node]) -> (usize, usize, usize) {
        let (mut dirs, mut files, mut dim) = (0, 0, 0);
        for n in nodes {
            if n.kind == "file" {
                files += 1;
            } else {
                dirs += 1;
                if n.has_notes == Some(false) {
                    dim += 1;
                }
                let (d, f, m) = count(n.children.as_deref().unwrap_or(&[]));
                dirs += d;
                files += f;
                dim += m;
            }
        }
        (dirs, files, dim)
    }

    #[test]
    #[ignore]
    fn scan_home() {
        let home = std::env::var("HOME").unwrap();
        for hidden in [false, true] {
            let start = std::time::Instant::now();
            let nodes = scan(&home, hidden).unwrap();
            let (dirs, files, dim) = count(&nodes);
            println!(
                "hidden={hidden}: {dirs} folders ({dim} without notes), {files} notes in {:?}",
                start.elapsed()
            );
        }
    }
}
