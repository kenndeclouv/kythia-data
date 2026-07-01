use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::time::SystemTime;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize)]
pub struct BackupPayload {
    pub connections: Option<Value>,
    pub settings: Option<Value>,
    pub gamification: Option<Value>,
}

#[tauri::command]
pub async fn export_backup(app_handle: AppHandle) -> Result<String, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let connections_file = app_dir.join("connections.json");
    let settings_file = app_dir.join("settings.json");
    let gamification_file = app_dir.join("gamification.json");

    let mut backup = BackupPayload {
        connections: None,
        settings: None,
        gamification: None,
    };

    if connections_file.exists() {
        if let Ok(data) = fs::read_to_string(&connections_file) {
            if let Ok(json) = serde_json::from_str::<Value>(&data) {
                backup.connections = Some(json);
            }
        }
    }

    if settings_file.exists() {
        if let Ok(data) = fs::read_to_string(&settings_file) {
            if let Ok(json) = serde_json::from_str::<Value>(&data) {
                backup.settings = Some(json);
            }
        }
    }

    if gamification_file.exists() {
        if let Ok(data) = fs::read_to_string(&gamification_file) {
            if let Ok(json) = serde_json::from_str::<Value>(&data) {
                backup.gamification = Some(json);
            }
        }
    }

    serde_json::to_string(&backup).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_backup(app_handle: AppHandle, payload: String) -> Result<(), String> {
    let backup: BackupPayload = serde_json::from_str(&payload).map_err(|e| e.to_string())?;

    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    }

    if let Some(connections) = backup.connections {
        let path = app_dir.join("connections.json");
        let data = serde_json::to_string_pretty(&connections).map_err(|e| e.to_string())?;
        fs::write(path, data).map_err(|e| e.to_string())?;
    }

    if let Some(settings) = backup.settings {
        let path = app_dir.join("settings.json");
        let data = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
        fs::write(path, data).map_err(|e| e.to_string())?;
    }

    if let Some(gamification) = backup.gamification {
        let path = app_dir.join("gamification.json");
        let data = serde_json::to_string_pretty(&gamification).map_err(|e| e.to_string())?;
        fs::write(path, data).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[derive(Serialize)]
pub struct BackupInfo {
    pub id: String,
    pub created_at: u64,
    pub size: u64,
}

#[tauri::command]
pub async fn create_local_backup(app_handle: AppHandle) -> Result<BackupInfo, String> {
    let backup_json = export_backup(app_handle.clone()).await?;
    
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let backups_dir = app_dir.join("backups");
    if !backups_dir.exists() {
        fs::create_dir_all(&backups_dir).map_err(|e| e.to_string())?;
    }
    
    let timestamp = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs();
    let filename = format!("backup-{}.json", timestamp);
    let filepath = backups_dir.join(&filename);
    
    fs::write(&filepath, &backup_json).map_err(|e| e.to_string())?;
    
    let metadata = fs::metadata(&filepath).map_err(|e| e.to_string())?;
    
    Ok(BackupInfo {
        id: filename,
        created_at: timestamp,
        size: metadata.len(),
    })
}

#[tauri::command]
pub async fn list_local_backups(app_handle: AppHandle) -> Result<Vec<BackupInfo>, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let backups_dir = app_dir.join("backups");
    
    if !backups_dir.exists() {
        return Ok(vec![]);
    }
    
    let mut backups = Vec::new();
    if let Ok(entries) = fs::read_dir(backups_dir) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    let filename = entry.file_name().to_string_lossy().to_string();
                    if filename.starts_with("backup-") && filename.ends_with(".json") {
                        let parts: Vec<&str> = filename.split('-').collect();
                        let mut timestamp = 0;
                        if parts.len() == 2 {
                            if let Ok(t) = parts[1].replace(".json", "").parse::<u64>() {
                                timestamp = t;
                            }
                        }
                        backups.push(BackupInfo {
                            id: filename,
                            created_at: timestamp,
                            size: metadata.len(),
                        });
                    }
                }
            }
        }
    }
    
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    
    Ok(backups)
}

#[tauri::command]
pub async fn restore_local_backup(app_handle: AppHandle, id: String) -> Result<(), String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let filepath = app_dir.join("backups").join(&id);
    
    let data = fs::read_to_string(&filepath).map_err(|e| e.to_string())?;
    import_backup(app_handle, data).await
}

#[tauri::command]
pub async fn delete_local_backup(app_handle: AppHandle, id: String) -> Result<(), String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let filepath = app_dir.join("backups").join(&id);
    
    fs::remove_file(filepath).map_err(|e| e.to_string())
}
