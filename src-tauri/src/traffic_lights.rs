//! Centres the macOS traffic lights on the app's top row, whatever its height.
//!
//! `trafficLightPosition` in tauri.conf.json is a guess in points from the top
//! edge, and AppKit resets the buttons on resize, full screen and theme changes.
//! This module instead sizes the title bar to the top row and centres each
//! button in it, so the lights follow the row. Change `TOP_ROW_HEIGHT` only
//! together with `TOP_ROW_HEIGHT` in src/lib/layout.ts (a test checks they match).

/// Height of the window's top row in points. Mirrors `TOP_ROW_HEIGHT` in
/// src/lib/layout.ts.
pub const TOP_ROW_HEIGHT: f64 = 40.0;
/// Distance from the window's left edge to the close button.
pub const LIGHTS_LEFT: f64 = 20.0;
/// Distance between the left edges of neighbouring buttons.
pub const LIGHTS_STEP: f64 = 20.0;

#[cfg(target_os = "macos")]
pub fn place(window: &tauri::Window) {
    use objc2_app_kit::{NSWindow, NSWindowButton};
    use objc2_foundation::{NSPoint, NSRect, NSSize};

    let Ok(ptr) = window.ns_window() else { return };
    if ptr.is_null() {
        return;
    }
    // SAFETY: Tauri hands out the live NSWindow of this window, and this runs on
    // the main thread (setup and window events both do).
    let ns_window: &NSWindow = unsafe { &*(ptr as *const NSWindow) };

    let buttons = [
        NSWindowButton::CloseButton,
        NSWindowButton::MiniaturizeButton,
        NSWindowButton::ZoomButton,
    ];
    let Some(close) = ns_window.standardWindowButton(buttons[0]) else { return };
    let Some(titlebar) = (unsafe { close.superview() }) else { return };
    let Some(container) = (unsafe { titlebar.superview() }) else { return };

    let window_height = ns_window.frame().size.height;
    let container_frame = container.frame();
    // The title bar container hangs from the top edge: AppKit's origin is the
    // bottom left, so its y is the window height minus its own height.
    container.setFrame(NSRect::new(
        NSPoint::new(container_frame.origin.x, window_height - TOP_ROW_HEIGHT),
        NSSize::new(container_frame.size.width, TOP_ROW_HEIGHT),
    ));
    titlebar.setFrame(NSRect::new(
        NSPoint::new(0.0, 0.0),
        NSSize::new(container_frame.size.width, TOP_ROW_HEIGHT),
    ));

    for (index, kind) in buttons.into_iter().enumerate() {
        let Some(button) = ns_window.standardWindowButton(kind) else { continue };
        let height = button.frame().size.height;
        button.setFrameOrigin(NSPoint::new(
            LIGHTS_LEFT + LIGHTS_STEP * index as f64,
            (TOP_ROW_HEIGHT - height) / 2.0,
        ));
    }
}

#[cfg(not(target_os = "macos"))]
pub fn place(_window: &tauri::Window) {}
