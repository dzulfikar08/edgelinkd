pub mod sqlite_config;
pub mod sqlite_query;

use crate::runtime::model::*;

/// Convert a rusqlite row column value to Variant.
/// Tries types in order: NULL, String, i64, f64, bool, Vec<u8> (blob).
pub(crate) fn row_to_variant(row: &rusqlite::Row, col_index: usize) -> Variant {
    // Try to detect NULL first via Option<String>
    let null_check: Result<Option<String>, _> = row.get(col_index);
    match null_check {
        Ok(None) => return Variant::Null,
        Ok(Some(s)) => return Variant::String(s),
        Err(_) => {}
    }

    // Try i64
    let i64_val: Result<i64, _> = row.get(col_index);
    if let Ok(i) = i64_val {
        return Variant::from(i);
    }

    // Try f64
    let f64_val: Result<f64, _> = row.get(col_index);
    if let Ok(f) = f64_val {
        return Variant::from(f);
    }

    // Try bool
    let bool_val: Result<bool, _> = row.get(col_index);
    if let Ok(b) = bool_val {
        return Variant::Bool(b);
    }

    // Try Vec<u8> (blob)
    let blob_val: Result<Vec<u8>, _> = row.get(col_index);
    if let Ok(bytes) = blob_val {
        return Variant::from(bytes);
    }

    Variant::Null
}
