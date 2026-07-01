# Architecture Details

Kythia Data is built on a modern stack comprising **Tauri v2**, **Rust**, and **React**. Unlike traditional Electron apps that bundle an entire Chromium instance, Tauri leverages the OS's native webview, resulting in dramatically lower memory usage and binary sizes.

## Core Stack

1. **Frontend**: React + TypeScript + Vite + Tailwind CSS. Provides a snappy, highly responsive user interface.
2. **Backend Engine**: Rust. Handles all native operating system interactions, direct database connections, and file I/O.
3. **Bridge**: Tauri's Inter-Process Communication (IPC). Allows the React frontend to seamlessly and asynchronously call Rust functions.

## Database Interaction

One of the defining features of Kythia Data is that it connects to databases *natively* rather than relying on a web backend (like PHP in phpMyAdmin) or a heavy JVM abstraction layer (like JDBC in DBeaver).

### Connection Pooling
When a user configures a connection in the UI, the frontend issues a Tauri command `test_connection` or attempts to fetch tables via `get_tables`. 

Behind the scenes, the Rust engine uses the robust **`sqlx`** crate to establish a native, asynchronous connection pool (`MySqlPool`) to the target database.

### State Management
Database connection pools are stored in Tauri's managed application state (`AppHandle::manage`), ensuring that connections are reused efficiently across different queries and tabs without re-authenticating every time.

```rust
pub struct DatabaseState {
    pub pools: Mutex<HashMap<String, MySqlPool>>,
}
```

### Raw SQL Execution
For maximum performance and flexibility, queries written in the SQL Editor are sent directly to the Rust backend via the `execute_raw_sql` command. Rust prepares (or directly executes) the SQL string and serializes the resulting rows into JSON, bypassing heavy ORMs.

## Gamification Engine

Kythia Data features a built-in gamification system to make database administration fun. 

The gamification data (XP, Coins, Unlocked Achievements) is persisted locally in `~/.kythia-data/gamification.json`. 

When certain actions occur in the React frontend (e.g., executing a successful query, exporting data, creating a database), the frontend triggers `unlockAchievement` using the `useGamification` hook. This hook sends an IPC command to Rust, which subsequently updates the local state and dispatches a Tauri event back to the frontend to trigger the achievement notification UI.
