mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::workspace::open_workspace,
            commands::workspace::create_workspace,
            commands::workspace::read_workspace_file,
            commands::workspace::write_workspace_file,
            commands::workspace::search_workspace,
            commands::book::create_book,
            commands::book::read_book,
            commands::book::read_chapter,
            commands::book::write_chapter,
            commands::book::create_chapter,
            commands::book::delete_chapter,
            commands::book::write_book_doc,
            commands::book::delete_book,
            commands::book::update_book_meta,
            commands::book::rename_chapter,
            commands::book::move_chapter,
            commands::book::export_book_markdown,
            commands::book::export_book_html,
            commands::book::export_book_pdf,
            commands::plugin::scan_plugins,
            commands::plugin::read_plugin_source,
            commands::plugin::ensure_example_plugin,
            commands::plugin::scan_market,
            commands::plugin::install_market_plugin,
            commands::plugin::open_market_folder,
            commands::fs::read_text_file,
            commands::fs::write_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
