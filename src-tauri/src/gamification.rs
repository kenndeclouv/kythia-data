use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::Timelike;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{Emitter, Manager};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GamificationData {
    pub level: u32,
    pub current_xp: u32,
    pub coins: u32,
    #[serde(default)]
    pub unlocked_achievements: Vec<String>,
    #[serde(default)]
    pub total_uptime_minutes: u64,
    #[serde(default)]
    pub purchased_items: Vec<String>,
    #[serde(default = "default_theme")]
    pub active_theme: String,
    #[serde(default = "default_sound_pack")]
    pub active_sound_pack: String,

    #[serde(default = "default_username")]
    pub username: String,
    #[serde(default = "default_nickname")]
    pub nickname: String,
    #[serde(default)]
    pub avatar_data: Option<String>,
    #[serde(default)]
    pub active_title: Option<String>,
    #[serde(default = "default_badge")]
    pub active_badge: String,
}

fn default_theme() -> String {
    "default".to_string()
}

fn default_sound_pack() -> String {
    "none".to_string()
}

fn default_username() -> String {
    "developer".to_string()
}

fn default_nickname() -> String {
    "Kythia Dev".to_string()
}

fn default_badge() -> String {
    "none".to_string()
}

impl Default for GamificationData {
    fn default() -> Self {
        Self {
            level: 1,
            current_xp: 0,
            coins: 0,
            unlocked_achievements: Vec::new(),
            total_uptime_minutes: 0,
            purchased_items: Vec::new(),
            active_theme: default_theme(),
            active_sound_pack: default_sound_pack(),
            username: default_username(),
            nickname: default_nickname(),
            avatar_data: None,
            active_title: None,
            active_badge: default_badge(),
        }
    }
}

// Simple XOR key to prevent casual cheating
const XOR_KEY: &[u8] = b"KythiaWorkspaceSecretKey2026";

fn get_gamification_path() -> PathBuf {
    PathBuf::from("C:\\kythia\\data\\gamification.dat") // changed extension to .dat to deter casual browsing
}

fn obfuscate(data: &str) -> String {
    let xored: Vec<u8> = data
        .bytes()
        .enumerate()
        .map(|(i, b)| b ^ XOR_KEY[i % XOR_KEY.len()])
        .collect();
    STANDARD.encode(&xored)
}

fn deobfuscate(data: &str) -> Result<String, String> {
    let decoded = STANDARD
        .decode(data)
        .map_err(|e| format!("Base64 Error: {}", e))?;
    let unxored: Vec<u8> = decoded
        .into_iter()
        .enumerate()
        .map(|(i, b)| b ^ XOR_KEY[i % XOR_KEY.len()])
        .collect();
    String::from_utf8(unxored).map_err(|e| format!("UTF8 Error: {}", e))
}

#[tauri::command]
pub fn get_gamification_data() -> Result<GamificationData, String> {
    let path = get_gamification_path();
    if !path.exists() {
        return Ok(GamificationData::default());
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read data: {}", e))?;

    match deobfuscate(&content) {
        Ok(json_str) => {
            let data: GamificationData = serde_json::from_str(&json_str).unwrap_or_default();
            Ok(data)
        }
        Err(_) => Ok(GamificationData::default()), // fallback if tampered
    }
}

#[tauri::command]
pub fn save_gamification_data(data: GamificationData) -> Result<(), String> {
    let path = get_gamification_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let json_str = serde_json::to_string(&data).map_err(|e| format!("Serialize error: {}", e))?;
    let obfuscated = obfuscate(&json_str);

    fs::write(&path, obfuscated).map_err(|e| format!("Failed to write data: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn add_xp(amount: u32) -> Result<GamificationData, String> {
    let mut data = get_gamification_data().unwrap_or_default();

    data.current_xp += amount;

    loop {
        let xp_needed = data.level * 100;
        if data.current_xp >= xp_needed {
            data.current_xp -= xp_needed;
            data.level += 1;
            data.coins += 50; // Bonus coins on level up
        } else {
            break;
        }
    }

    save_gamification_data(data.clone())?;
    Ok(data)
}

#[tauri::command]
pub fn add_coins(amount: u32) -> Result<GamificationData, String> {
    let mut data = get_gamification_data().unwrap_or_default();
    data.coins += amount;
    save_gamification_data(data.clone())?;
    Ok(data)
}

#[tauri::command]
pub fn purchase_item(id: String, cost: u32) -> Result<GamificationData, String> {
    let mut data = get_gamification_data().unwrap_or_default();

    if data.purchased_items.contains(&id) {
        return Err("Item already purchased".to_string());
    }

    if data.coins < cost {
        return Err("Not enough coins".to_string());
    }

    data.coins -= cost;
    data.purchased_items.push(id.clone());

    save_gamification_data(data.clone())?;
    Ok(data)
}

#[tauri::command]
pub fn equip_theme(id: String) -> Result<GamificationData, String> {
    let mut data = get_gamification_data().unwrap_or_default();

    // Allow equipping default without purchasing
    if id != "default" && !data.purchased_items.contains(&id) {
        return Err("You don't own this theme".to_string());
    }

    data.active_theme = id;
    save_gamification_data(data.clone())?;
    Ok(data)
}

#[tauri::command]
pub fn equip_sound(id: String) -> Result<GamificationData, String> {
    let mut data = get_gamification_data().unwrap_or_default();

    if id != "none" && !data.purchased_items.contains(&id) {
        return Err("You don't own this sound pack".to_string());
    }

    data.active_sound_pack = id;
    save_gamification_data(data.clone())?;
    Ok(data)
}

#[tauri::command]
pub fn equip_badge(id: String) -> Result<GamificationData, String> {
    let mut data = get_gamification_data().unwrap_or_default();

    if id != "none" && !data.purchased_items.contains(&id) {
        return Err("You don't own this badge".to_string());
    }

    data.active_badge = id;
    save_gamification_data(data.clone())?;
    Ok(data)
}

#[tauri::command]
pub fn update_profile(
    username: String,
    nickname: String,
    avatar_data: Option<String>,
) -> Result<GamificationData, String> {
    let mut data = get_gamification_data().unwrap_or_default();

    data.username = username;
    data.nickname = nickname;
    if avatar_data.is_some() {
        data.avatar_data = avatar_data;
    }

    save_gamification_data(data.clone())?;
    Ok(data)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UnlockResult {
    pub success: bool,
    pub message: String,
    pub data: GamificationData,
}

#[tauri::command]
pub fn unlock_achievement(
    id: String,
    reward_xp: u32,
    reward_coins: u32,
) -> Result<UnlockResult, String> {
    let mut data = get_gamification_data().unwrap_or_default();

    if data.unlocked_achievements.contains(&id) {
        return Ok(UnlockResult {
            success: false,
            message: "Already unlocked".to_string(),
            data,
        });
    }

    data.unlocked_achievements.push(id.clone());
    data.current_xp += reward_xp;
    data.coins += reward_coins;

    // Level up check
    loop {
        let xp_needed = data.level * 100;
        if data.current_xp >= xp_needed {
            data.current_xp -= xp_needed;
            data.level += 1;
            data.coins += 50;
        } else {
            break;
        }
    }

    save_gamification_data(data.clone())?;

    Ok(UnlockResult {
        success: true,
        message: format!("Unlocked: {}", id),
        data,
    })
}

pub fn start_time_tracker(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;

            let state = app.state::<crate::DatabaseState>();
            let pools = state.pools.lock().unwrap();
            let is_any_running = !pools.is_empty();
            drop(pools); // release lock early

            if is_any_running {
                let mut data = get_gamification_data().unwrap_or_default();
                data.total_uptime_minutes += 1;

                let now = chrono::Local::now();
                let hour = now.hour();

                let mut newly_unlocked = Vec::new();

                if data.total_uptime_minutes >= 1440
                    && !data
                        .unlocked_achievements
                        .contains(&"marathon_24h".to_string())
                {
                    newly_unlocked.push(("marathon_24h".to_string(), 500, 100));
                }
                if data.total_uptime_minutes >= 6000
                    && !data
                        .unlocked_achievements
                        .contains(&"marathon_100h".to_string())
                {
                    newly_unlocked.push(("marathon_100h".to_string(), 1000, 250));
                }
                if data.total_uptime_minutes >= 30000
                    && !data
                        .unlocked_achievements
                        .contains(&"marathon_500h".to_string())
                {
                    newly_unlocked.push(("marathon_500h".to_string(), 5000, 1000));
                }
                if hour < 4
                    && !data
                        .unlocked_achievements
                        .contains(&"night_owl".to_string())
                {
                    newly_unlocked.push(("night_owl".to_string(), 250, 50));
                }
                if hour >= 4
                    && hour < 7
                    && !data
                        .unlocked_achievements
                        .contains(&"early_bird".to_string())
                {
                    newly_unlocked.push(("early_bird".to_string(), 250, 50));
                }

                let has_unlocked = !newly_unlocked.is_empty();

                for (id, xp, coins) in newly_unlocked {
                    data.unlocked_achievements.push(id.clone());
                    data.current_xp += xp;
                    data.coins += coins;
                    let _ = app.emit("unlock-achievement-server", id);
                }

                if has_unlocked {
                    loop {
                        let xp_needed = data.level * 100;
                        if data.current_xp >= xp_needed {
                            data.current_xp -= xp_needed;
                            data.level += 1;
                            data.coins += 50;
                        } else {
                            break;
                        }
                    }
                }

                let _ = save_gamification_data(data);
                let _ = app.emit("gamification-update-server", ());
            }
        }
    });
}

#[derive(Clone, Serialize)]
pub struct GitCommitEvent {
    pub project: String,
    pub message: String,
}


#[tauri::command]
pub fn delete_account() -> Result<(), String> {
    let path = get_gamification_path();
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
