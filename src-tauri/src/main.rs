// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

#[tauri::command]
fn minimize_window(window: tauri::Window) {
  window.minimize().unwrap();
}

#[tauri::command]
fn toggle_maximize(window: tauri::Window) {
  if window.is_maximized().unwrap() {
    window.unmaximize().unwrap();
  } else {
    window.maximize().unwrap();
  }
}

#[tauri::command]
fn close_window(window: tauri::Window) {
  window.close().unwrap();
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![minimize_window, toggle_maximize, close_window])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
