import { useState, useEffect, useRef, useCallback } from "react";
import Editor, { useMonaco } from "@monaco-editor/react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Play, Loader2, Wand2, GripHorizontal, History, X, Clock } from "lucide-react";
import { format } from "sql-formatter";
import SqlResultGrid from "./SqlResultGrid";
import { Button } from "../ui/button";
import { useGamification } from "../../hooks/useGamification";

interface SqlEditorProps {
  connId: string;
  initialQuery?: string;
}

export default function SqlEditor({ connId, initialQuery }: SqlEditorProps) {
  const { unlockAchievement, playSoundEffect } = useGamification();
  const [query, setQuery] = useState(initialQuery || "SELECT * FROM ");
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<{ columns: string[], rows: any[], rowsAffected: number, executionTimeMs: number } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Query history — persisted in localStorage keyed by connId
  const HISTORY_KEY = `kythia_query_history_${connId}`;
  const [queryHistory, setQueryHistory] = useState<{ sql: string; timestamp: number }[]>(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
  });
  const [editorHeightPct, setEditorHeightPct] = useState(50);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientY - rect.top) / rect.height) * 100;
      setEditorHeightPct(Math.min(85, Math.max(15, pct)));
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const monaco = useMonaco();
  const editorRef = useRef<any>(null);

  const queryRef = useRef(query);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const executeQuery = useCallback(async () => {
    const currentQuery = queryRef.current;
    if (!currentQuery.trim()) return;
    
    setIsExecuting(true);
    try {
      let sqlToRun = currentQuery;
      if (editorRef.current) {
        const selection = editorRef.current.getSelection();
        if (selection && !selection.isEmpty()) {
          sqlToRun = editorRef.current.getModel().getValueInRange(selection);
        }
      }
      
      const res: any = await invoke("execute_raw_sql", { connId, sql: sqlToRun });
      setResult({
        columns: res.columns,
        rows: res.rows,
        rowsAffected: res.rows_affected,
        executionTimeMs: res.execution_time_ms
      });
      playSoundEffect();
      // Save to history (deduplicate + max 50)
      const trimmed = sqlToRun.trim();
      setQueryHistory(prev => {
        const withoutDup = prev.filter(h => h.sql !== trimmed);
        const next = [{ sql: trimmed, timestamp: Date.now() }, ...withoutDup].slice(0, 50);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return next;
      });
      
      // Gamification
      unlockAchievement('query_beginner');
      const upper = sqlToRun.toUpperCase();
      if (upper.includes("DROP TABLE")) unlockAchievement('bobby_tables');
      if (upper.includes("INSERT ") || upper.includes("UPDATE ") || upper.includes("DELETE ")) unlockAchievement('query_master');
      
    } catch (e: any) {
      toast.error(`Query failed: ${e}`);
      if (e.toString().toLowerCase().includes("access denied") || e.toString().toLowerCase().includes("denied")) {
        unlockAchievement('access_denied');
      }
    } finally {
      setIsExecuting(false);
    }
  }, [connId, queryHistory]);

  // Schema: { tableName: [{ column_name, data_type }] }
  type ColumnInfo = { column_name: string; data_type: string };
  const schemaRef = useRef<Record<string, ColumnInfo[]>>({});

  useEffect(() => {
    // Fetch full DB schema (all tables + columns) for rich autocomplete
    invoke("get_database_schema", { connId }).then((res: unknown) => {
      const rows = res as any[];
      const schema: Record<string, ColumnInfo[]> = {};
      for (const col of rows) {
        if (!schema[col.table_name]) schema[col.table_name] = [];
        schema[col.table_name].push({ column_name: col.column_name, data_type: col.data_type });
      }
      schemaRef.current = schema;
    }).catch(console.error);
  }, [connId]);

  useEffect(() => {
    if (monaco) {
      const disposable = monaco.languages.registerCompletionItemProvider('sql', {
        triggerCharacters: [' ', '.', '(', ','],
        provideCompletionItems: (model, position) => {
          const schema = schemaRef.current;
          const allTables = Object.keys(schema);

          const textUntilCursor = model.getValueInRange({
            startLineNumber: 1, startColumn: 1,
            endLineNumber: position.lineNumber, endColumn: position.column,
          });

          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          // -----------------------------------------------
          // Helper: build alias -> realTableName map
          // -----------------------------------------------
          const buildAliasMap = (text: string): Record<string, string> => {
            const map: Record<string, string> = {};
            const re = /(?:FROM|JOIN)\s+`?(\w+)`?\s+(?:AS\s+)?`?(\w+)`?(?:\s|,|$)/gi;
            let m: RegExpExecArray | null;
            while ((m = re.exec(text)) !== null) {
              const tbl = m[1].toLowerCase();
              const alias = m[2].toLowerCase();
              map[alias] = tbl;
              map[tbl] = tbl; // table name is also its own alias
            }
            // Also catch bare: FROM table (no alias)
            const re2 = /(?:FROM|JOIN)\s+`?(\w+)`?(?:\s*(?:WHERE|GROUP|ORDER|LIMIT|JOIN|LEFT|RIGHT|INNER|FULL|ON|SET|HAVING|$))/gi;
            while ((m = re2.exec(text)) !== null) {
              const tbl = m[1].toLowerCase();
              if (!map[tbl]) map[tbl] = tbl;
            }
            return map;
          };

          // -----------------------------------------------
          // Helper: get columns for a set of real table names
          // -----------------------------------------------
          const getColumnsForTables = (tableNames: string[]): any[] => {
            const cols: any[] = [];
            const seen = new Set<string>();
            for (const tbl of tableNames) {
              const realTbl = Object.keys(schema).find(k => k.toLowerCase() === tbl) || tbl;
              for (const col of (schema[realTbl] || [])) {
                const key = `${col.column_name}:${realTbl}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  cols.push({
                    label: col.column_name,
                    kind: monaco.languages.CompletionItemKind.Field,
                    insertText: col.column_name,
                    detail: `${col.data_type} · ${realTbl}`,
                    sortText: '0' + col.column_name,
                    range,
                  });
                }
              }
            }
            return cols;
          };

          // -----------------------------------------------
          // Dot-notation: alias.col or table.col
          // -----------------------------------------------
          const dotMatch = textUntilCursor.match(/(\w+)\.\w*$/);
          if (dotMatch) {
            const prefix = dotMatch[1].toLowerCase();
            const aliasMap = buildAliasMap(textUntilCursor);
            const resolvedTable = aliasMap[prefix] || allTables.find(t => t.toLowerCase() === prefix);
            if (resolvedTable) {
              const realTbl = Object.keys(schema).find(k => k.toLowerCase() === resolvedTable) || resolvedTable;
              return {
                suggestions: (schema[realTbl] || []).map(col => ({
                  label: col.column_name,
                  kind: monaco.languages.CompletionItemKind.Field,
                  insertText: col.column_name,
                  detail: col.data_type,
                  sortText: '0' + col.column_name,
                  range,
                }))
              } as any;
            }
            return { suggestions: [] } as any;
          }

          // -----------------------------------------------
          // Detect SQL context by finding the last significant keyword
          // -----------------------------------------------
          const upperText = textUntilCursor.toUpperCase().trimEnd();

          // The last "clause-level" keyword before the cursor
          const clausePattern = /\b(SELECT|FROM|WHERE|SET|ON|HAVING|GROUP\s+BY|ORDER\s+BY|DISTINCT|AND|OR|NOT|IN|BETWEEN|LIKE|CASE|WHEN|THEN|ELSE|VALUES|INSERT\s+INTO|UPDATE|DELETE\s+FROM|JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|INNER\s+JOIN|FULL\s+OUTER\s+JOIN|CROSS\s+JOIN|LIMIT|OFFSET|UNION(?:\s+ALL)?)\s*$/;
          const lastClauseMatch = clausePattern.exec(upperText);
          const lastClause = lastClauseMatch ? lastClauseMatch[1].replace(/\s+/g, ' ').trim() : null;

          const aliasMap = buildAliasMap(textUntilCursor);
          const referencedTableNames = Object.values(aliasMap);

          // -----------------------------------------------
          // Context: after FROM / JOIN → suggest tables
          // -----------------------------------------------
          if (lastClause && ['FROM', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL OUTER JOIN', 'CROSS JOIN', 'UPDATE'].includes(lastClause)) {
            return {
              suggestions: allTables.map(table => ({
                label: table,
                kind: monaco.languages.CompletionItemKind.Class,
                insertText: table,
                detail: 'Table',
                sortText: '0' + table,
                range,
              }))
            } as any;
          }

          // -----------------------------------------------
          // Context: after WHERE / AND / OR / NOT / ON / HAVING / SET / BETWEEN / CASE / WHEN / THEN / ELSE
          // → suggest columns of tables referenced in the query
          // -----------------------------------------------
          const columnContextKeywords = ['WHERE', 'AND', 'OR', 'NOT', 'ON', 'HAVING', 'SET', 'BETWEEN', 'WHEN', 'THEN', 'ELSE', 'IN', 'LIKE'];
          if (lastClause && columnContextKeywords.includes(lastClause)) {
            const cols = getColumnsForTables(referencedTableNames.length ? referencedTableNames : allTables.map(t => t.toLowerCase()));
            const operatorItems = ['=', '!=', '<>', '<', '>', '<=', '>=', 'IS NULL', 'IS NOT NULL', 'IN ()', 'NOT IN ()', 'LIKE', 'BETWEEN', 'AND', 'OR'].map(op => ({
              label: op,
              kind: monaco.languages.CompletionItemKind.Operator,
              insertText: op,
              detail: 'Operator',
              sortText: '5' + op,
              range,
            }));
            return { suggestions: [...cols, ...operatorItems] } as any;
          }

          // -----------------------------------------------
          // Context: after SELECT / DISTINCT / GROUP BY / ORDER BY / HAVING
          // → suggest columns of referenced tables + aggregate functions
          // -----------------------------------------------
          const selectContextKeywords = ['SELECT', 'DISTINCT', 'GROUP BY', 'ORDER BY'];
          if (lastClause && selectContextKeywords.includes(lastClause)) {
            const cols = getColumnsForTables(referencedTableNames.length ? referencedTableNames : allTables.map(t => t.toLowerCase()));
            const aggItems = ['COUNT(*)', 'COUNT()', 'SUM()', 'AVG()', 'MAX()', 'MIN()', 'COALESCE()', 'IFNULL()', 'NULLIF()', 'CONCAT()', 'LENGTH()', 'UPPER()', 'LOWER()', 'NOW()', 'DATE_FORMAT()', 'SUBSTRING()', 'CAST()', 'CONVERT()'].map(fn => ({
              label: fn,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: fn,
              detail: 'Function',
              sortText: '1' + fn,
              range,
            }));
            // Also show table names after SELECT for table.*
            const tableItems = allTables.map(t => ({
              label: t,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: t,
              detail: 'Table',
              sortText: '2' + t,
              range,
            }));
            return { suggestions: [...cols, ...aggItems, ...tableItems] } as any;
          }

          // -----------------------------------------------
          // Context: after VALUES / INSERT INTO — skip suggestions (user fills in literals)
          // -----------------------------------------------
          if (lastClause && ['VALUES', 'INSERT INTO'].includes(lastClause)) {
            return { suggestions: [] } as any;
          }

          // -----------------------------------------------
          // Default: at start of statement — show keywords + tables
          // -----------------------------------------------
          const SQL_KEYWORDS = [
            'SELECT', 'SELECT DISTINCT', 'FROM', 'WHERE', 'INSERT INTO', 'VALUES',
            'UPDATE', 'SET', 'DELETE FROM', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
            'INNER JOIN', 'FULL OUTER JOIN', 'CROSS JOIN', 'ON', 'GROUP BY',
            'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT', 'ASC', 'DESC',
            'AND', 'OR', 'NOT', 'IN', 'NOT IN', 'LIKE', 'BETWEEN', 'IS NULL',
            'IS NOT NULL', 'AS', 'UNION', 'UNION ALL', 'EXISTS', 'CASE', 'WHEN',
            'THEN', 'ELSE', 'END', 'CREATE TABLE', 'DROP TABLE', 'ALTER TABLE',
            'TRUNCATE TABLE', 'SHOW TABLES', 'DESCRIBE', 'EXPLAIN',
          ];
          const keywordItems = SQL_KEYWORDS.map(kw => ({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            detail: 'SQL Keyword',
            sortText: '1' + kw,
            range,
          }));
          const tableItems = allTables.map(t => ({
            label: t,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: t,
            detail: 'Table',
            sortText: '2' + t,
            range,
          }));
          return { suggestions: [...keywordItems, ...tableItems] } as any;
        }
      });

      return () => disposable.dispose();
    }
  }, [monaco, connId]);



  const handleEditorDidMount = (editor: any, monacoInstance: any) => {
    editorRef.current = editor;

    monacoInstance.editor.defineTheme('kythia-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#0f0f11',
        'editor.lineHighlightBackground': '#1f1f22',
        'editorLineNumber.foreground': '#555555',
        'editorIndentGuide.background': '#222222',
      }
    });
    monacoInstance.editor.setTheme('kythia-dark');
    
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter, () => {
      executeQuery();
    });
    
    editor.addCommand(monacoInstance.KeyCode.F5, () => {
      executeQuery();
    });
  };

  const handleFormat = () => {
    try {
      const formatted = format(query, { language: 'mysql', tabWidth: 2, keywordCase: 'upper' });
      setQuery(formatted);
    } catch (e) {
      toast.error("Failed to format SQL. Check your syntax.");
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden !bg-transparent !p-0 !m-0">
      <div className="bg-[#18181b]/50 border-b border-border py-1.5 px-3 flex items-center gap-2 z-10 shadow-sm">
        <Button 
          variant="default" 
          size="sm" 
          onClick={executeQuery} 
          disabled={isExecuting}
          className="bg-green-600 hover:bg-green-700 text-white h-7 px-3 text-xs shadow-none border-0"
        >
          {isExecuting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />}
          Run Query <span className="text-white/60 ml-2 font-mono text-[10px]">Ctrl+Enter</span>
        </Button>
        <div className="w-px h-4 bg-border mx-1"></div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleFormat}
          className="text-muted-foreground hover:text-foreground hover:bg-muted/80 h-7 px-2 text-xs"
        >
          <Wand2 className="w-3.5 h-3.5 mr-1.5" />
          Format SQL
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory(h => !h)}
          className={`h-7 px-2 text-xs transition-colors ${
            showHistory ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
          }`}
        >
          <History className="w-3.5 h-3.5 mr-1.5" />
          History {queryHistory.length > 0 && <span className="ml-1 bg-zinc-600 text-zinc-200 text-[10px] px-1 rounded-full">{queryHistory.length}</span>}
        </Button>
      </div>

      {/* Split pane: editor top, results bottom, custom drag handle */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden relative" style={{ minHeight: 0 }}>

        {/* History panel — slides in from right */}
        {showHistory && (
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-card/95 backdrop-blur-md border-l border-border z-30 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Query History
              </div>
              <button onClick={() => setShowHistory(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {queryHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                  <Clock className="w-8 h-8 mb-2 opacity-30" />
                  <p>No queries yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {queryHistory.map((h, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setQuery(h.sql); setShowHistory(false); }}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="text-[11px] text-muted-foreground mb-1 font-mono">
                        {new Date(h.timestamp).toLocaleString()}
                      </div>
                      <div className="text-xs font-mono text-zinc-300 group-hover:text-foreground line-clamp-3 break-all leading-relaxed">
                        {h.sql}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {queryHistory.length > 0 && (
              <div className="border-t border-border p-3 flex-shrink-0">
                <button
                  onClick={() => { setQueryHistory([]); localStorage.removeItem(HISTORY_KEY); }}
                  className="text-xs text-red-500 hover:text-red-400 transition-colors w-full text-center font-medium"
                >
                  Clear History
                </button>
              </div>
            )}
          </div>
        )}

        {/* Vertical split panes */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>

        {/* Editor pane */}
        <div style={{ height: `${editorHeightPct}%`, minHeight: 0 }} className="overflow-hidden !p-0 !m-0 !bg-transparent">
          <Editor
            height="100%"
            defaultLanguage="sql"
            theme="kythia-dark"
            value={query}
            onChange={(val) => setQuery(val || "")}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
              lineHeight: 1.6,
              padding: { top: 0, bottom: 0 },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              formatOnPaste: false,
              renderLineHighlight: "all",
              suggest: { showProperties: true, showKeywords: true },
            }}
          />
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={onDragStart}
          className="flex-shrink-0 h-[6px] bg-zinc-800 hover:bg-primary/80 active:bg-primary transition-colors cursor-row-resize flex items-center justify-center group"
        >
          <GripHorizontal className="w-4 h-3 text-zinc-600 group-hover:text-blue-300 transition-colors" />
        </div>

        {/* Results pane */}
        <div style={{ height: `${100 - editorHeightPct}%`, minHeight: 0 }} className="overflow-hidden !bg-transparent">
          {result ? (
            <SqlResultGrid
              columns={result.columns}
              rows={result.rows}
              executionTimeMs={result.executionTimeMs}
              rowsAffected={result.rowsAffected}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground !bg-transparent">
              <div className="text-zinc-500 mb-2">
                <Play className="w-8 h-8 opacity-20 mx-auto mb-3" />
                <p>Run a query to see results here</p>
              </div>
            </div>
          )}
        </div>
        </div>{/* end vertical split panes */}
      </div>{/* end relative container */}
    </div>
  );
}
