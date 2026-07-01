pub mod db;
pub mod gamification;
pub mod settings;
pub mod backup;

use serde::{Deserialize, Serialize};
use sqlx::{mysql::MySqlConnectOptions, mysql::MySqlPoolOptions, Connection, MySqlPool};
use std::fs;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConnectionPayload {
    pub name: Option<String>,
    pub tag: Option<String>,
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: Option<String>,
    pub database: Option<String>,
    pub color: Option<String>,
    #[serde(rename = "sslMode")]
    pub ssl_mode: Option<String>,
    #[serde(rename = "tlsVersion")]
    pub tls_version: Option<String>,
}

pub struct DatabaseState {
    pub pools: Mutex<HashMap<String, MySqlPool>>,
}

#[tauri::command]
async fn connect_workspace(
    app_handle: AppHandle,
    state: State<'_, DatabaseState>,
    index: usize,
) -> Result<String, String> {
    // 1. Get the connection payload
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let connections_file = app_dir.join("connections.json");

    let mut payload = None;
    if connections_file.exists() {
        if let Ok(data) = fs::read_to_string(&connections_file) {
            if let Ok(parsed) = serde_json::from_str::<Vec<ConnectionPayload>>(&data) {
                if index < parsed.len() {
                    payload = Some(parsed[index].clone());
                }
            }
        }
    }

    let payload = payload.ok_or_else(|| "Connection not found".to_string())?;

    // 2. Build options
    let mut options = MySqlConnectOptions::new()
        .host(&payload.host)
        .port(payload.port)
        .username(&payload.user);

    if let Some(pwd) = &payload.password {
        if !pwd.is_empty() {
            options = options.password(pwd);
        }
    }

    if let Some(db) = &payload.database {
        if !db.is_empty() {
            options = options.database(db);
        }
    }

    // 3. Create Pool
    let pool = MySqlPoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .map_err(|e| e.to_string())?;

    // 4. Save to State
    let conn_id = format!("conn_{}", index);
    {
        let mut pools = state.pools.lock().map_err(|_| "Failed to lock state")?;
        pools.insert(conn_id.clone(), pool);
    }

    Ok(conn_id)
}

#[tauri::command]
async fn test_connection(payload: ConnectionPayload) -> Result<String, String> {
    let mut options = MySqlConnectOptions::new()
        .host(&payload.host)
        .port(payload.port)
        .username(&payload.user);

    if let Some(pwd) = &payload.password {
        if !pwd.is_empty() {
            options = options.password(pwd);
        }
    }

    if let Some(db) = &payload.database {
        if !db.is_empty() {
            options = options.database(db);
        }
    }

    // sqlx handles connection on connect()
    let mut conn = sqlx::MySqlConnection::connect_with(&options)
        .await
        .map_err(|e| e.to_string())?;

    conn.ping().await.map_err(|e| e.to_string())?;

    Ok("Connection successful".into())
}

#[tauri::command]
async fn save_connection(app_handle: AppHandle, payload: ConnectionPayload) -> Result<(), String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    }

    let connections_file = app_dir.join("connections.json");

    let mut connections: Vec<ConnectionPayload> = vec![];
    if connections_file.exists() {
        if let Ok(data) = fs::read_to_string(&connections_file) {
            if let Ok(parsed) = serde_json::from_str(&data) {
                connections = parsed;
            }
        }
    }

    connections.push(payload);

    let data = serde_json::to_string_pretty(&connections).map_err(|e| e.to_string())?;
    fs::write(&connections_file, data).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn get_connections(app_handle: AppHandle) -> Result<Vec<ConnectionPayload>, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let connections_file = app_dir.join("connections.json");

    if connections_file.exists() {
        if let Ok(data) = fs::read_to_string(&connections_file) {
            if let Ok(parsed) = serde_json::from_str(&data) {
                return Ok(parsed);
            }
        }
    }
    
    Ok(vec![])
}

#[tauri::command]
async fn delete_connection(app_handle: AppHandle, index: usize) -> Result<(), String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let connections_file = app_dir.join("connections.json");

    if connections_file.exists() {
        if let Ok(data) = fs::read_to_string(&connections_file) {
            if let Ok(mut parsed) = serde_json::from_str::<Vec<ConnectionPayload>>(&data) {
                if index < parsed.len() {
                    parsed.remove(index);
                    let new_data = serde_json::to_string_pretty(&parsed).map_err(|e| e.to_string())?;
                    fs::write(&connections_file, new_data).map_err(|e| e.to_string())?;
                }
            }
        }
    }
    
    Ok(())
}

#[tauri::command]
async fn get_connection(app_handle: AppHandle, index: usize) -> Result<Option<ConnectionPayload>, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let connections_file = app_dir.join("connections.json");

    if connections_file.exists() {
        if let Ok(data) = fs::read_to_string(&connections_file) {
            if let Ok(parsed) = serde_json::from_str::<Vec<ConnectionPayload>>(&data) {
                if index < parsed.len() {
                    return Ok(Some(parsed[index].clone()));
                }
            }
        }
    }
    
    Ok(None)
}

#[tauri::command]
async fn edit_connection(app_handle: AppHandle, index: usize, payload: ConnectionPayload) -> Result<(), String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let connections_file = app_dir.join("connections.json");

    if connections_file.exists() {
        if let Ok(data) = fs::read_to_string(&connections_file) {
            if let Ok(mut parsed) = serde_json::from_str::<Vec<ConnectionPayload>>(&data) {
                if index < parsed.len() {
                    parsed[index] = payload;
                    let new_data = serde_json::to_string_pretty(&parsed).map_err(|e| e.to_string())?;
                    fs::write(&connections_file, new_data).map_err(|e| e.to_string())?;
                }
            }
        }
    }
    
    Ok(())
}

#[derive(Serialize)]
pub struct TableInfo {
    pub name: String,
    pub table_type: String,
}

#[derive(Serialize)]
pub struct TableDataResult {
    pub columns: Vec<String>,
    pub rows: Vec<serde_json::Value>,
}

#[tauri::command]
async fn get_databases(state: State<'_, DatabaseState>, conn_id: String) -> Result<Vec<String>, String> {
    let pool = {
        let pools = state.pools.lock().map_err(|_| "State lock failed")?;
        pools.get(&conn_id).cloned().ok_or("Connection not found")?
    };
    db::mysql::get_databases(&pool).await
}

#[tauri::command]
async fn get_tables(state: State<'_, DatabaseState>, conn_id: String) -> Result<Vec<TableInfo>, String> {
    let pool = {
        let pools = state.pools.lock().map_err(|_| "State lock failed")?;
        pools.get(&conn_id).cloned().ok_or("Connection not found")?
    };
    db::mysql::get_tables(&pool).await
}

#[tauri::command]
async fn get_table_data(state: State<'_, DatabaseState>, conn_id: String, table_name: String, limit: u32, offset: u32) -> Result<TableDataResult, String> {
    let pool = {
        let pools = state.pools.lock().map_err(|_| "State lock failed")?;
        pools.get(&conn_id).cloned().ok_or("Connection not found")?
    };
    db::mysql::get_table_data(&pool, &table_name, limit, offset).await
}

#[tauri::command]
async fn get_table_schema(state: State<'_, DatabaseState>, conn_id: String, table_name: String) -> Result<Vec<db::mysql::ColumnSchema>, String> {
    let pool = {
        let pools = state.pools.lock().map_err(|_| "State lock failed")?;
        pools.get(&conn_id).cloned().ok_or("Connection not found")?
    };
    db::mysql::get_table_schema(&pool, &table_name).await
}

#[tauri::command]
async fn update_row(
    state: State<'_, DatabaseState>, 
    conn_id: String, 
    table_name: String, 
    pk_col: String, 
    pk_val: serde_json::Value, 
    updates: std::collections::HashMap<String, serde_json::Value>
) -> Result<(), String> {
    let pool = {
        let pools = state.pools.lock().map_err(|_| "State lock failed")?;
        pools.get(&conn_id).cloned().ok_or("Connection not found")?
    };
    db::mysql::update_row(&pool, &table_name, &pk_col, &pk_val, updates).await
}

#[tauri::command]
async fn insert_row(
    state: State<'_, DatabaseState>, 
    conn_id: String, 
    table_name: String, 
    data: std::collections::HashMap<String, serde_json::Value>
) -> Result<(), String> {
    let pool = {
        let pools = state.pools.lock().map_err(|_| "State lock failed")?;
        pools.get(&conn_id).cloned().ok_or("Connection not found")?
    };
    db::mysql::insert_row(&pool, &table_name, data).await
}

#[tauri::command]
async fn delete_row(
    state: State<'_, DatabaseState>, 
    conn_id: String, 
    table_name: String, 
    pk_col: String, 
    pk_val: serde_json::Value
) -> Result<(), String> {
    let pool = {
        let pools = state.pools.lock().map_err(|_| "State lock failed")?;
        pools.get(&conn_id).cloned().ok_or("Connection not found")?
    };
    db::mysql::delete_row(&pool, &table_name, &pk_col, &pk_val).await
}

#[tauri::command]
async fn execute_raw_sql(
    state: tauri::State<'_, DatabaseState>, 
    conn_id: String, 
    sql: String
) -> Result<db::mysql::RawSqlResult, String> {
    let pool = {
        let pools = state.pools.lock().map_err(|_| "State lock failed")?;
        pools.get(&conn_id).cloned().ok_or("Connection not found")?
    };
    db::mysql::execute_raw_sql(&pool, &sql).await
}

#[tauri::command]
async fn get_database_schema(
    state: tauri::State<'_, DatabaseState>,
    conn_id: String,
) -> Result<Vec<db::mysql::DbColumn>, String> {
    let pool = {
        let pools = state.pools.lock().map_err(|_| "State lock failed")?;
        pools.get(&conn_id).cloned().ok_or("Connection not found")?
    };
    db::mysql::get_database_schema(&pool).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent};
                use tauri::menu::{Menu, MenuItem};
                use tauri::Manager;

                let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
                let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

                let _tray = TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            let windows = app.webview_windows();
                            let mut shown_workspace = false;
                            for (label, window) in windows.iter() {
                                if label.starts_with("workspace-") {
                                    let _ = window.show();
                                    let _ = window.unminimize();
                                    let _ = window.set_focus();
                                    shown_workspace = true;
                                }
                            }
                            if !shown_workspace {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.unminimize();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event {
                            let app = tray.app_handle();
                            let windows = app.webview_windows();
                            let mut shown_workspace = false;
                            for (label, window) in windows.iter() {
                                if label.starts_with("workspace-") {
                                    let _ = window.show();
                                    let _ = window.unminimize();
                                    let _ = window.set_focus();
                                    shown_workspace = true;
                                }
                            }
                            if !shown_workspace {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.unminimize();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    })
                    .build(app)?;
            }
            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" {
                    let settings = crate::settings::get_settings().unwrap_or_default();
                    if settings.close_to_tray {
                        let _ = window.hide();
                        api.prevent_close();
                    }
                }
            }
            _ => {}
        })
        .manage(DatabaseState {
            pools: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            test_connection, 
            save_connection, 
            get_connections, 
            delete_connection,
            get_connection,
            edit_connection,
            connect_workspace,
            get_databases,
            get_tables,
            get_table_data,
            get_table_schema,
            update_row,
            insert_row,
            delete_row,
            execute_raw_sql,
            get_database_schema,
            gamification::get_gamification_data,
            gamification::save_gamification_data,
            gamification::add_xp,
            gamification::add_coins,
            gamification::purchase_item,
            gamification::equip_theme,
            gamification::equip_sound,
            gamification::equip_badge,
            gamification::update_profile,
            gamification::unlock_achievement,
            gamification::delete_account,
            settings::get_settings,
            settings::save_settings,
            backup::export_backup,
            backup::import_backup,
            backup::create_local_backup,
            backup::list_local_backups,
            backup::restore_local_backup,
            backup::delete_local_backup
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
