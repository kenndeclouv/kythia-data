import { useState, useMemo, useCallback, useRef } from "react";
import { Download, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../ui/context-menu";

interface SqlResultGridProps {
  columns: string[];
  rows: any[];
  executionTimeMs: number;
  rowsAffected?: number;
}

type SortDir = "asc" | "desc" | null;

async function exportCSV(columns: string[], rows: any[]) {
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const content = columns.join(",") + "\n" + rows.map(r => columns.map(c => escape(r[c])).join(",")).join("\n");
  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: "query_result.csv",
      types: [{ description: "CSV File", accept: { "text/csv": [".csv"] } }]
    });
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  } catch (e: any) {
    if (e?.name !== "AbortError") {
      const blob = new Blob([content], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "query_result.csv"; a.click();
      URL.revokeObjectURL(url);
    }
  }
}

async function exportJSON(columns: string[], rows: any[]) {
  const data = rows.map(r => { const o: Record<string, any> = {}; columns.forEach(c => { o[c] = r[c] ?? null; }); return o; });
  const content = JSON.stringify(data, null, 2);
  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: "query_result.json",
      types: [{ description: "JSON File", accept: { "application/json": [".json"] } }]
    });
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  } catch (e: any) {
    if (e?.name !== "AbortError") {
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "query_result.json"; a.click();
      URL.revokeObjectURL(url);
    }
  }
}

export default function SqlResultGrid({ columns, rows, executionTimeMs, rowsAffected }: SqlResultGridProps) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

  // Column Resizing
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizingCol = useRef<string | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDownResize = (e: React.MouseEvent, col: string) => {
    e.stopPropagation();
    e.preventDefault();
    resizingCol.current = col;
    startX.current = e.clientX;
    startWidth.current = colWidths[col] || 200; // default 200px
    
    const onMouseMove = (moveEvt: MouseEvent) => {
      if (!resizingCol.current) return;
      const diff = moveEvt.clientX - startX.current;
      setColWidths(prev => ({
        ...prev,
        [resizingCol.current as string]: Math.max(50, startWidth.current + diff)
      }));
    };
    
    const onMouseUp = () => {
      resizingCol.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleSort = useCallback((col: string) => {
    if (sortCol !== col) {
      setSortCol(col); setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortCol(null); setSortDir(null);
    }
  }, [sortCol, sortDir]);

  const sortedRows = useMemo(() => {
    if (!sortCol || !sortDir) return rows;
    return [...rows].sort((a, b) => {
      const va = a[sortCol]; const vb = b[sortCol];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const cmp = typeof va === "number" && typeof vb === "number"
        ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortCol, sortDir]);



  if (columns.length === 0 && rows.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center !bg-transparent text-muted-foreground">
        <div className="text-lg mb-2 text-foreground">Query Executed Successfully</div>
        <div className="text-sm">
          {rowsAffected !== undefined && <span className="font-mono text-foreground">{rowsAffected}</span>}
          {rowsAffected !== undefined && " row(s) affected in "}
          <span className="font-mono text-foreground">{executionTimeMs}</span> ms
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col !bg-transparent overflow-hidden">
      {/* Status bar */}
      <div className="bg-muted/30 px-4 py-2 border-b border-border text-[11px] text-muted-foreground flex items-center justify-between gap-4 uppercase font-semibold tracking-wider shadow-sm z-20 relative flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {rows.length} rows retrieved
          </span>
          <span>{executionTimeMs}ms execution time</span>
        </div>
        {/* Export dropdown */}
        <div className="relative">
          <button
            onClick={() => setExportOpen(o => !o)}
            className="flex items-center gap-1 px-2 py-1 rounded-xl hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors normal-case tracking-normal font-medium"
          >
            <Download className="w-3 h-3" />
            Export
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-1 bg-[#2d2d30] border border-zinc-700 rounded-md shadow-xl z-50 min-w-[140px] overflow-hidden">
              <button
                onClick={() => { exportCSV(columns, sortedRows); setExportOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                Download CSV
              </button>
              <button
                onClick={() => { exportJSON(columns, sortedRows); setExportOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                Download JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scrollbar" onClick={() => setExportOpen(false)}>
        <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
          <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm z-10 shadow-sm">
            <tr>
              <th className="font-semibold px-4 py-2 border-r border-border border-b w-12 text-center text-muted-foreground bg-muted/40">#</th>
              {columns.map((col, idx) => {
                const isActive = sortCol === col;
                return (
                  <th
                    key={idx}
                    onClick={() => handleSort(col)}
                    style={{ width: colWidths[col] || 200, minWidth: colWidths[col] || 100, maxWidth: colWidths[col] || 600 }}
                    className="font-semibold px-3 py-2 border-r border-border border-b text-[12px] text-muted-foreground whitespace-nowrap cursor-pointer select-none group hover:bg-muted/80 transition-colors relative"
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className={`truncate transition-colors ${isActive ? "text-foreground font-bold" : "group-hover:text-foreground"}`}>{col}</span>
                      <span className="ml-auto flex-shrink-0">
                        {isActive && sortDir === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-foreground" /> :
                         isActive && sortDir === "desc" ? <ChevronDown className="w-3.5 h-3.5 text-foreground" /> :
                         <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </span>
                    </div>
                    {/* Drag Handle */}
                    <div 
                      onMouseDown={(e) => onMouseDownResize(e, col)}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500 z-20"
                    />
                  </th>
                );
              })}
              {/* Copy col */}
              <th className="w-8 border-b border-border bg-muted/40" />
            </tr>
          </thead>
          <tbody className="text-zinc-300">
            {sortedRows.map((row, rowIndex) => {
              const isSelected = selectedRowIndex === rowIndex;
              return (
                <ContextMenu key={rowIndex}>
                  <ContextMenuTrigger asChild>
                    <tr
                      onClick={() => setSelectedRowIndex(rowIndex)}
                      className={`border-b border-zinc-800/50 transition-colors group cursor-pointer ${
                        isSelected ? "bg-[#005fb8] text-white" : "hover:bg-muted/30"
                      }`}
                    >
                  <td className={`px-2 py-1 text-center text-[11px] border-r border-border select-none ${
                    isSelected ? "text-white/70" : "text-muted-foreground bg-muted/10 group-hover:text-foreground group-hover:bg-muted/30"
                  }`}>
                    {rowIndex + 1}
                  </td>
                  {columns.map((col, colIndex) => {
                    const val = row[col];
                    const isNull = val === null || val === undefined;
                    return (
                      <td 
                        key={colIndex} 
                        style={{ width: colWidths[col] || 200, minWidth: colWidths[col] || 100, maxWidth: colWidths[col] || 600 }}
                        className="px-4 py-1.5 border-r border-border/50 truncate text-[13px] font-mono"
                      >
                        {isNull ? (
                          <span className={`italic ${isSelected ? "text-white/50" : "text-zinc-500"}`}>NULL</span>
                        ) : typeof val === "object" ? (
                          <span className={isSelected ? "text-white/70" : "text-zinc-400"}>{JSON.stringify(val)}</span>
                        ) : (
                          <span>{String(val)}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="w-8 border-r border-zinc-800/50" />
                    </tr>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56 bg-[#2d2d30] border-zinc-700 text-zinc-300">
                    <ContextMenuItem 
                      onClick={() => {
                        const obj: Record<string, any> = {};
                        columns.forEach(c => { obj[c] = row[c] ?? null; });
                        navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
                        toast.success("Row copied as JSON");
                      }}
                      className="focus:bg-zinc-700 focus:text-white cursor-pointer"
                    >
                      Copy Row as JSON
                    </ContextMenuItem>
                    <ContextMenuItem 
                      onClick={() => {
                        const cols = columns.map(c => `\`${c}\``).join(", ");
                        const vals = columns.map(c => {
                          const v = row[c];
                          if (v === null || v === undefined) return "NULL";
                          if (typeof v === "number" || typeof v === "boolean") return v;
                          return `'${String(v).replace(/'/g, "''")}'`;
                        }).join(", ");
                        // For generic queries we don't know the table name easily, so we use a placeholder or generic name
                        navigator.clipboard.writeText(`INSERT INTO \`table_name\` (${cols}) VALUES (${vals});`);
                        toast.success("Row copied as SQL");
                      }}
                      className="focus:bg-zinc-700 focus:text-white cursor-pointer"
                    >
                      Copy Row as SQL INSERT
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
