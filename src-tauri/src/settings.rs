use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default)]
pub struct AppSettings {
    pub appearance: String,
    pub autostart: bool,
    pub close_to_tray: bool,
    pub minimize_to_tray: bool,
    #[serde(default = "default_true")]
    pub native_notifications: bool,
}

fn default_true() -> bool {
    true
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            appearance: "dark".to_string(),
            autostart: false,
            close_to_tray: true,
            minimize_to_tray: false,
            native_notifications: true,
        }
    }
}

pub fn get_settings_path() -> PathBuf {
    PathBuf::from("C:\\kythia\\data\\kythia_data_settings.json")
}

#[tauri::command]
pub fn get_settings() -> Result<AppSettings, String> {
    let path = get_settings_path();
    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let content =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read settings: {}", e))?;
    let settings: AppSettings = serde_json::from_str(&content).unwrap_or_default();
    Ok(settings)
}

use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = get_settings_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&path, content).map_err(|e| format!("Failed to write settings: {}", e))?;

    // Apply autostart logic
    let autolaunch = app.autolaunch();
    if settings.autostart {
        let _ = autolaunch.enable();
    } else {
        let _ = autolaunch.disable();
    }

    Ok(())
}
