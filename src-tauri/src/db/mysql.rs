use sqlx::{MySqlPool, Row, Column, TypeInfo, QueryBuilder, MySql};
use serde::Serialize;
use std::collections::HashMap;
use crate::{TableInfo, TableDataResult};
use std::time::Instant;
use futures::TryStreamExt;
use sqlx::Either;

#[derive(Serialize)]
pub struct ColumnSchema {
    pub field: String,
    pub type_name: String,
    pub null: String,
    pub key: String,
    pub default_val: Option<String>,
    pub extra: String,
    pub comment: String,
}

pub async fn get_table_schema(pool: &MySqlPool, table_name: &str) -> Result<Vec<ColumnSchema>, String> {
    let mut builder: QueryBuilder<MySql> = QueryBuilder::new("SHOW FULL COLUMNS FROM `");
    builder.push(table_name.replace("`", ""));
    builder.push("`");
    
    let rows = builder.build()
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut schema = Vec::new();
    for row in rows {
        let field: String = row.try_get("Field").unwrap_or_default();
        let type_name: String = row.try_get("Type").unwrap_or_default();
        let null: String = row.try_get("Null").unwrap_or_default();
        let key: String = row.try_get("Key").unwrap_or_default();
        let default_val: Option<String> = row.try_get("Default").ok();
        let extra: String = row.try_get("Extra").unwrap_or_default();
        let comment: String = row.try_get("Comment").unwrap_or_default();

        schema.push(ColumnSchema {
            field,
            type_name,
            null,
            key,
            default_val,
            extra,
            comment,
        });
    }
    Ok(schema)
}

#[derive(Serialize)]
pub struct DbColumn {
    pub table_name: String,
    pub column_name: String,
    pub data_type: String,
}

pub async fn get_database_schema(pool: &MySqlPool) -> Result<Vec<DbColumn>, String> {
    let rows = sqlx::query(
        r#"
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME, ORDINAL_POSITION
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut schema = Vec::new();
    for row in rows {
        let table_name: String = row.try_get("TABLE_NAME").unwrap_or_default();
        let column_name: String = row.try_get("COLUMN_NAME").unwrap_or_default();
        let data_type: String = row.try_get("DATA_TYPE").unwrap_or_default();
        schema.push(DbColumn { table_name, column_name, data_type });
    }
    Ok(schema)
}


#[derive(Serialize)]
pub struct RawSqlResult {
    pub columns: Vec<String>,
    pub rows: Vec<serde_json::Value>,
    pub rows_affected: u64,
    pub execution_time_ms: u64,
}

pub async fn execute_raw_sql(pool: &MySqlPool, sql: &str) -> Result<RawSqlResult, String> {
    let start = Instant::now();
    let mut stream = sqlx::raw_sql(sqlx::AssertSqlSafe(sql.to_string())).fetch_many(pool);
    let mut columns = Vec::new();
    let mut result_rows = Vec::new();
    let mut rows_affected = 0;
    let mut columns_initialized = false;
    
    while let Some(res) = stream.try_next().await.map_err(|e| e.to_string())? {
        match res {
            Either::Right(row) => {
                if !columns_initialized {
                    for col in row.columns() {
                        columns.push(col.name().to_string());
                    }
                    columns_initialized = true;
                }
                
                let mut map = serde_json::Map::new();
                for col in row.columns() {
                    let col_name = col.name();
                    let type_name = col.type_info().name();
                    
                    let val: serde_json::Value = match type_name {
                        "TINYINT" | "SMALLINT" | "INT" | "BIGINT" => {
                            if let Ok(v) = row.try_get::<i64, _>(col.ordinal()) { serde_json::json!(v) } else { serde_json::Value::Null }
                        },
                        "TINYINT UNSIGNED" | "SMALLINT UNSIGNED" | "INT UNSIGNED" | "BIGINT UNSIGNED" => {
                            if let Ok(v) = row.try_get::<u64, _>(col.ordinal()) { serde_json::json!(v) } else { serde_json::Value::Null }
                        },
                        "FLOAT" | "DOUBLE" | "DECIMAL" => {
                            if let Ok(v) = row.try_get::<f64, _>(col.ordinal()) { serde_json::json!(v) } else { serde_json::Value::Null }
                        },
                        "BOOLEAN" | "TINYINT(1)" => {
                            if let Ok(v) = row.try_get::<bool, _>(col.ordinal()) { serde_json::json!(v) } else { serde_json::Value::Null }
                        },
                        _ => {
                            if let Ok(v) = row.try_get::<String, _>(col.ordinal()) { 
                                serde_json::json!(v) 
                            } else if let Ok(v) = row.try_get::<i64, _>(col.ordinal()) {
                                serde_json::json!(v)
                            } else if let Ok(v) = row.try_get::<u64, _>(col.ordinal()) {
                                serde_json::json!(v)
                            } else if let Ok(v) = row.try_get::<f64, _>(col.ordinal()) {
                                serde_json::json!(v)
                            } else if let Ok(v) = row.try_get::<chrono::NaiveDateTime, _>(col.ordinal()) {
                                serde_json::json!(v.format("%Y-%m-%d %H:%M:%S").to_string())
                            } else if let Ok(v) = row.try_get::<chrono::DateTime<chrono::Utc>, _>(col.ordinal()) {
                                serde_json::json!(v.format("%Y-%m-%d %H:%M:%S").to_string())
                            } else if let Ok(v) = row.try_get::<chrono::NaiveDate, _>(col.ordinal()) {
                                serde_json::json!(v.format("%Y-%m-%d").to_string())
                            } else if let Ok(v) = row.try_get::<chrono::NaiveTime, _>(col.ordinal()) {
                                serde_json::json!(v.format("%H:%M:%S").to_string())
                            } else if let Ok(v) = row.try_get::<Vec<u8>, _>(col.ordinal()) {
                                serde_json::json!(String::from_utf8_lossy(&v).to_string())
                            } else {
                                serde_json::Value::Null
                            }
                        }
                    };
                    map.insert(col_name.to_string(), val);
                }
                result_rows.push(serde_json::Value::Object(map));
            },
            Either::Left(query_result) => {
                rows_affected += query_result.rows_affected();
            }
        }
    }
    
    let duration = start.elapsed();
    
    Ok(RawSqlResult {
        columns,
        rows: result_rows,
        rows_affected,
        execution_time_ms: duration.as_millis() as u64,
    })
}

pub async fn update_row(
    pool: &MySqlPool,
    table_name: &str,
    pk_col: &str,
    pk_val: &serde_json::Value,
    updates: HashMap<String, serde_json::Value>
) -> Result<(), String> {
    if updates.is_empty() { return Ok(()); }
    
    let mut builder: QueryBuilder<MySql> = QueryBuilder::new("UPDATE `");
    builder.push(table_name.replace("`", ""));
    builder.push("` SET ");
    
    let mut first = true;
    for (k, v) in updates {
        if !first {
            builder.push(", ");
        }
        first = false;
        
        builder.push(format!("`{}` = ", k.replace("`", "")));
        match v {
            serde_json::Value::Null => { builder.push("NULL"); },
            serde_json::Value::String(s) => { builder.push_bind(s); },
            serde_json::Value::Number(n) => {
                if let Some(i) = n.as_i64() {
                    builder.push_bind(i);
                } else if let Some(f) = n.as_f64() {
                    builder.push_bind(f);
                }
            },
            serde_json::Value::Bool(b) => { builder.push_bind(b); },
            _ => return Err("Unsupported update value type".to_string()),
        }
    }
    
    builder.push(" WHERE `");
    builder.push(pk_col.replace("`", ""));
    builder.push("` = ");
    
    match pk_val {
        serde_json::Value::String(s) => { builder.push_bind(s.clone()); },
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                builder.push_bind(i);
            } else if let Some(u) = n.as_u64() {
                builder.push_bind(u);
            } else if let Some(f) = n.as_f64() {
                builder.push_bind(f);
            } else { return Err("Invalid PK number".into()); }
        },
        _ => return Err(format!("Unsupported PK type: {:?}", pk_val)),
    }
    
    builder.build().execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn insert_row(
    pool: &MySqlPool,
    table_name: &str,
    data: HashMap<String, serde_json::Value>
) -> Result<(), String> {
    if data.is_empty() { return Err("No data to insert".to_string()); }
    
    let mut builder: QueryBuilder<MySql> = QueryBuilder::new("INSERT INTO `");
    builder.push(table_name.replace("`", ""));
    builder.push("` (");
    
    let mut first = true;
    for (k, _) in &data {
        if !first { builder.push(", "); }
        first = false;
        builder.push(format!("`{}`", k.replace("`", "")));
    }
    
    builder.push(") VALUES (");
    
    first = true;
    for (_, v) in data {
        if !first { builder.push(", "); }
        first = false;
        match v {
            serde_json::Value::Null => { builder.push("NULL"); },
            serde_json::Value::String(s) => { builder.push_bind(s); },
            serde_json::Value::Number(n) => {
                if let Some(i) = n.as_i64() {
                    builder.push_bind(i);
                } else if let Some(f) = n.as_f64() {
                    builder.push_bind(f);
                }
            },
            serde_json::Value::Bool(b) => { builder.push_bind(b); },
            _ => return Err("Unsupported insert value type".to_string()),
        }
    }
    builder.push(")");
    
    builder.build().execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn get_databases(pool: &MySqlPool) -> Result<Vec<String>, String> {
    let rows = sqlx::query("SHOW DATABASES")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut dbs = Vec::new();
    for row in rows {
        let db_name: String = row.try_get(0).map_err(|e| e.to_string())?;
        dbs.push(db_name);
    }
    Ok(dbs)
}

pub async fn get_tables(pool: &MySqlPool) -> Result<Vec<TableInfo>, String> {
    let rows = sqlx::query("SHOW FULL TABLES")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut tables = Vec::new();
    for row in rows {
        let name: String = row.try_get(0).unwrap_or_default();
        let table_type: String = row.try_get(1).unwrap_or_default();
        tables.push(TableInfo { name, table_type });
    }
    Ok(tables)
}

pub async fn get_table_data(pool: &MySqlPool, table_name: &str, limit: u32, offset: u32) -> Result<TableDataResult, String> {
    let mut builder: QueryBuilder<MySql> = QueryBuilder::new("SELECT * FROM `");
    builder.push(table_name.replace("`", ""));
    builder.push("` LIMIT ");
    builder.push_bind(limit);
    builder.push(" OFFSET ");
    builder.push_bind(offset);
    
    let rows = builder.build()
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    if rows.is_empty() {
        return Ok(TableDataResult { columns: vec![], rows: vec![] });
    }

    let mut cols = Vec::new();
    for col in rows[0].columns() {
        cols.push(col.name().to_string());
    }

    let mut result_rows = Vec::new();
    for row in rows {
        let mut map = serde_json::Map::new();
        for col in row.columns() {
            let col_name = col.name();
            let type_name = col.type_info().name();
            
            let val: serde_json::Value = match type_name {
                "TINYINT" | "SMALLINT" | "INT" | "BIGINT" => {
                    if let Ok(v) = row.try_get::<i64, _>(col.ordinal()) { serde_json::json!(v) } else { serde_json::Value::Null }
                },
                "TINYINT UNSIGNED" | "SMALLINT UNSIGNED" | "INT UNSIGNED" | "BIGINT UNSIGNED" => {
                    if let Ok(v) = row.try_get::<u64, _>(col.ordinal()) { serde_json::json!(v) } else { serde_json::Value::Null }
                },
                "FLOAT" | "DOUBLE" | "DECIMAL" => {
                    if let Ok(v) = row.try_get::<f64, _>(col.ordinal()) { serde_json::json!(v) } else { serde_json::Value::Null }
                },
                "BOOLEAN" | "TINYINT(1)" => {
                    if let Ok(v) = row.try_get::<bool, _>(col.ordinal()) { serde_json::json!(v) } else { serde_json::Value::Null }
                },
                _ => {
                    if let Ok(v) = row.try_get::<String, _>(col.ordinal()) { 
                        serde_json::json!(v) 
                    } else if let Ok(v) = row.try_get::<i64, _>(col.ordinal()) {
                        serde_json::json!(v)
                    } else if let Ok(v) = row.try_get::<u64, _>(col.ordinal()) {
                        serde_json::json!(v)
                    } else if let Ok(v) = row.try_get::<f64, _>(col.ordinal()) {
                        serde_json::json!(v)
                    } else if let Ok(v) = row.try_get::<chrono::NaiveDateTime, _>(col.ordinal()) {
                        serde_json::json!(v.format("%Y-%m-%d %H:%M:%S").to_string())
                    } else if let Ok(v) = row.try_get::<chrono::DateTime<chrono::Utc>, _>(col.ordinal()) {
                        serde_json::json!(v.format("%Y-%m-%d %H:%M:%S").to_string())
                    } else if let Ok(v) = row.try_get::<chrono::NaiveDate, _>(col.ordinal()) {
                        serde_json::json!(v.format("%Y-%m-%d").to_string())
                    } else if let Ok(v) = row.try_get::<chrono::NaiveTime, _>(col.ordinal()) {
                        serde_json::json!(v.format("%H:%M:%S").to_string())
                    } else if let Ok(v) = row.try_get::<Vec<u8>, _>(col.ordinal()) {
                        serde_json::json!(String::from_utf8_lossy(&v).to_string())
                    } else {
                        serde_json::Value::Null
                    }
                }
            };
            map.insert(col_name.to_string(), val);
        }
        result_rows.push(serde_json::Value::Object(map));
    }

    Ok(TableDataResult { columns: cols, rows: result_rows })
}

pub async fn delete_row(
    pool: &MySqlPool,
    table_name: &str,
    pk_col: &str,
    pk_val: &serde_json::Value
) -> Result<(), String> {
    let mut builder: QueryBuilder<MySql> = QueryBuilder::new("DELETE FROM `");
    builder.push(table_name.replace("`", ""));
    builder.push("` WHERE `");
    builder.push(pk_col.replace("`", ""));
    builder.push("` = ");
    
    match pk_val {
        serde_json::Value::String(s) => { builder.push_bind(s.clone()); },
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                builder.push_bind(i);
            } else if let Some(u) = n.as_u64() {
                builder.push_bind(u);
            } else if let Some(f) = n.as_f64() {
                builder.push_bind(f);
            } else { return Err("Invalid PK number".into()); }
        },
        _ => return Err(format!("Unsupported PK type: {:?}", pk_val)),
    }
    
    builder.build()
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
        
    Ok(())
}
