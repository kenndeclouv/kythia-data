import { useState, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Loader2, Plus, Save, AlertTriangle, CalendarIcon, ChevronUp, ChevronDown, ChevronsUpDown, Search, Download } from "lucide-react";
import SchemaGrid from "./SchemaGrid";
import { format } from "date-fns";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import ExportTableModal from "./ExportTableModal";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { cn } from "../../lib/utils";

interface ColumnSchema {
  field: string;
  type_name: string;
  null: string;
  key: string;
  default_val: string | null;
  extra: string;
  comment: string;
}

interface DataGridProps {
  connId: string;
  tableName: string;
  onRowSelect?: (rowData: any, schema: ColumnSchema[], stageEdit: (colName: string, val: string) => void) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export default function DataGrid({ connId, tableName, onRowSelect, onDirtyChange }: DataGridProps) {
  const [schema, setSchema] = useState<ColumnSchema[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [newRows, setNewRows] = useState<Record<string, any>[]>([]);
  
  const allRows = [...rows, ...newRows];

  const [isLoading, setIsLoading] = useState(true);
  const [isCommitting, setIsCommitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'structure'>('data');
  
  // Pagination
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 100;
  
  // rowIndex -> { colName -> newValue }
  const [stagedChanges, setStagedChanges] = useState<Record<number, Record<string, any>>>({});
  
  // Editing state
  const [editingCell, setEditingCell] = useState<{rowIndex: number, colName: string} | null>(null);
  const [editValue, setEditValue] = useState("");
  
  // Row selection
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  
  // Deleted rows
  const [deletedRows, setDeletedRows] = useState<number[]>([]);

  // Sort state
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);

  // Filter/search state
  const [filterText, setFilterText] = useState("");

  const [exportModalOpen, setExportModalOpen] = useState(false);

  const pkCol = useMemo(() => schema.find(s => s.key === "PRI")?.field, [schema]);

  // Derived: sorted + filtered rows (base = allRows to include new unsaved rows)
  const filteredRows = useMemo(() => {
    let r = allRows;
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      r = r.filter(row =>
        columns.some(col => {
          const v = row[col];
          return v !== null && v !== undefined && String(v).toLowerCase().includes(q);
        })
      );
    }
    if (sortCol && sortDir) {
      r = [...r].sort((a, b) => {
        const va = a[sortCol]; const vb = b[sortCol];
        if (va === null || va === undefined) return 1;
        if (vb === null || vb === undefined) return -1;
        const cmp = typeof va === "number" && typeof vb === "number"
          ? va - vb : String(va).localeCompare(String(vb));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return r;
  }, [allRows, filterText, sortCol, sortDir, columns]);

  const handleSort = (col: string) => {
    if (sortCol !== col) { setSortCol(col); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSortCol(null); setSortDir(null); }
  };

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

  useEffect(() => {
    loadTable();
  }, [connId, tableName]);

  // Global keydown for Ctrl+S and Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        commitChanges();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRowIndex !== null && selectedRowIndex < rows.length) {
        e.preventDefault();
        if (!pkCol) {
          toast.error("Cannot delete row without a Primary Key.");
          return;
        }

        setDeletedRows(prev => {
          if (prev.includes(selectedRowIndex)) {
            return prev.filter(r => r !== selectedRowIndex); // Undo delete
          } else {
            return [...prev, selectedRowIndex]; // Stage delete
          }
        });
        
        // Clear any staged edits for this row
        setStagedChanges(prev => {
          if (prev[selectedRowIndex]) {
            const newStaged = { ...prev };
            delete newStaged[selectedRowIndex];
            return newStaged;
          }
          return prev;
        });
      }
    };
    
    const handleDiscard = () => {
      setStagedChanges({});
      setNewRows([]);
      setDeletedRows([]);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('kythia:discard', handleDiscard);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('kythia:discard', handleDiscard);
    };
  }, [stagedChanges, newRows, deletedRows, schema, rows, selectedRowIndex, pkCol]);

  // Sync selected row to parent whenever data changes
  useEffect(() => {
    if (selectedRowIndex !== null && onRowSelect) {
      const row = allRows[selectedRowIndex];
      if (row) {
        const stagedRowChanges = stagedChanges[selectedRowIndex] || {};
        const mergedRow = { ...row, ...stagedRowChanges };
        onRowSelect(mergedRow, schema, (colName, val) => stageEdit(selectedRowIndex, colName, val));
      }
    }
  }, [stagedChanges, rows, newRows, selectedRowIndex, schema]);

  useEffect(() => {
    if (onDirtyChange) {
      const isDirty = Object.keys(stagedChanges).length > 0 || newRows.length > 0 || deletedRows.length > 0;
      onDirtyChange(isDirty);
    }
  }, [stagedChanges, newRows, deletedRows]);

  const loadTable = async () => {
    setIsLoading(true);
    setStagedChanges({});
    setEditingCell(null);
    setNewRows([]);
    setDeletedRows([]);
    try {
      // 1. Fetch Schema
      const s: ColumnSchema[] = await invoke("get_table_schema", { connId, tableName });
      setSchema(s);

      // 2. Fetch Data
      setOffset(0);
      const res: {columns: string[], rows: any[]} = await invoke("get_table_data", { connId, tableName, limit: LIMIT, offset: 0 });
      setColumns(res.columns.length > 0 ? res.columns : s.map(col => col.field));
      setRows(res.rows);
      setHasMore(res.rows.length === LIMIT);
    } catch (e) {
      toast.error(`Failed to load table: ${e}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = async () => {
    try {
      const nextOffset = offset + LIMIT;
      const res: {columns: string[], rows: any[]} = await invoke("get_table_data", { connId, tableName, limit: LIMIT, offset: nextOffset });
      setRows(prev => [...prev, ...res.rows]);
      setOffset(nextOffset);
      setHasMore(res.rows.length === LIMIT);
    } catch (e) {
      toast.error(`Failed to load more data: ${e}`);
    }
  };

  const getEditorType = (colName: string) => {
    const colSchema = schema.find(s => s.field === colName);
    if (!colSchema) return 'text';
    
    const t = colSchema.type_name.toLowerCase();
    if (t.includes('tinyint(1)') || t.includes('bool')) return 'boolean';
    if (t.includes('date') || t.includes('time')) return 'datetime';
    if (t.includes('int') || t.includes('float') || t.includes('double') || t.includes('decimal')) return 'number';
    return 'text';
  };

  const startEdit = (rowIndex: number, colName: string, currentValue: any) => {
    if (!pkCol && rowIndex < rows.length) {
      toast.error("Cannot edit table without a Primary Key.");
      return;
    }
    setEditingCell({ rowIndex, colName });
    // Check if there's a staged value first
    const existingStaged = stagedChanges[rowIndex]?.[colName];
    setEditValue(existingStaged !== undefined ? String(existingStaged) : (currentValue === null || currentValue === undefined ? "" : String(currentValue)));
  };

  const saveEdit = () => {
    if (!editingCell) return;
    const { rowIndex, colName } = editingCell;
    const originalValue = allRows[rowIndex]?.[colName];
    
    // Only stage if it actually changed
    // We treat empty string as empty string, not NULL for now (this can be improved later to support explicit NULLs)
    if (editValue !== String(originalValue)) {
      setStagedChanges(prev => {
        const rowChanges = prev[rowIndex] || {};
        return {
          ...prev,
          [rowIndex]: {
            ...rowChanges,
            [colName]: editValue
          }
        };
      });
    }
    
    setEditingCell(null);
  };

  const stageEdit = (rowIndex: number, colName: string, val: string) => {
    if (!pkCol && rowIndex < rows.length) {
      toast.error("Cannot edit table without a Primary Key.");
      return;
    }
    const originalValue = allRows[rowIndex]?.[colName];
    if (val !== String(originalValue)) {
      setStagedChanges(prev => {
        const rowChanges = prev[rowIndex] || {};
        return {
          ...prev,
          [rowIndex]: {
            ...rowChanges,
            [colName]: val
          }
        };
      });
    } else {
      setStagedChanges(prev => {
        const newStaged = { ...prev };
        if (newStaged[rowIndex]) {
          const rowChanges = { ...newStaged[rowIndex] };
          delete rowChanges[colName];
          if (Object.keys(rowChanges).length === 0) {
            delete newStaged[rowIndex];
          } else {
            newStaged[rowIndex] = rowChanges;
          }
        }
        return newStaged;
      });
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveEdit();
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  const numChanges = Object.keys(stagedChanges).length + newRows.length + deletedRows.length;

  const commitChanges = async () => {
    if (numChanges === 0) return;
    if (!pkCol) return;
    
    if (deletedRows.length > 0) {
      setShowDeleteConfirm(true);
      return;
    }

    await executeCommitChanges();
  };

  const executeCommitChanges = async () => {
    setIsCommitting(true);
    let successCount = 0;
    let errorCount = 0;
    
    // Process Deletions
    for (const rowIndex of deletedRows) {
      try {
        const pkVal = rows[rowIndex][pkCol as string];
        await invoke("delete_row", {
          connId,
          tableName,
          pkCol,
          pkVal
        });
        successCount++;
      } catch (e) {
        errorCount++;
        toast.error(`Failed to delete row ${rowIndex + 1}: ${e}`);
      }
    }

    for (const rowIndexStr of Object.keys(stagedChanges)) {
      const rowIndex = parseInt(rowIndexStr, 10);
      const updates = stagedChanges[rowIndex];

      try {
        if (rowIndex >= rows.length) {
          // INSERT
          await invoke("insert_row", {
            connId,
            tableName,
            data: updates
          });
          successCount++;
        } else {
          // UPDATE
          const pkVal = rows[rowIndex][pkCol as string];
          await invoke("update_row", {
            connId,
            tableName,
            pkCol,
            pkVal,
            updates
          });
          successCount++;
          // Apply changes locally to rows
          setRows(prev => {
            const newRowsLocal = [...prev];
            newRowsLocal[rowIndex] = { ...newRowsLocal[rowIndex], ...updates };
            return newRowsLocal;
          });
        }
      } catch (e) {
        errorCount++;
        toast.error(`Failed on row ${rowIndex + 1}: ${e}`);
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully saved ${successCount} row(s)`);
      if (errorCount === 0) {
        setStagedChanges({});
        setNewRows([]);
        loadTable(); // reload to get proper PKs and defaults for inserted rows
      } else {
        loadTable();
      }
    }
    
    setIsCommitting(false);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-600 mb-4" />
        <p className="text-zinc-500 text-sm">Loading data...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-popover border-border text-popover-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This action cannot be undone. You are about to permanently delete {deletedRows.length} row(s) from the <span className="font-semibold text-zinc-300">{tableName}</span> table.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setShowDeleteConfirm(false);
                executeCommitChanges();
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Row(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!pkCol && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 flex items-center gap-2 text-yellow-500 text-xs">
          <AlertTriangle className="w-4 h-4" />
          <span>This table does not have a Primary Key. Editing is disabled to prevent accidental data corruption.</span>
        </div>
      )}

      {activeTab === 'data' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filter / Search bar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/20 border-b border-border flex-shrink-0">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              placeholder="Filter rows..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="flex-1 bg-transparent text-[13px] text-foreground placeholder-muted-foreground outline-none font-medium"
            />
            {filterText && (
              <button onClick={() => setFilterText('')} className="text-muted-foreground hover:text-foreground text-xs transition-colors p-1 rounded hover:bg-muted">
                ✕
              </button>
            )}
            {filterText && (
              <span className="text-[11px] text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded-md">{filteredRows.length} match</span>
            )}
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left text-[13px] border-collapse relative">
            <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm z-10 shadow-sm">
              <tr>
                <th className="w-10 border-r border-b border-border bg-muted/40" />
                {columns.map(col => {
                  const isPk = col === pkCol;
                  const isActive = sortCol === col;
                  const colDef = schema.find(s => s.field === col);
                  const tooltip = colDef?.comment ? `${col}\n\n${colDef.comment}` : col;
                  return (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      style={{ width: colWidths[col] || 200, minWidth: colWidths[col] || 100, maxWidth: colWidths[col] || 600 }}
                      className="px-3 py-2 font-semibold text-[12px] border-r border-b border-border text-muted-foreground whitespace-nowrap cursor-pointer select-none group hover:bg-muted/80 transition-colors relative"
                      title={tooltip}
                    >
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        {isPk && <span className="text-yellow-500 text-[10px] flex-shrink-0" title="Primary Key">🔑</span>}
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
                {/* copy col header */}
                <th className="w-8 border-b border-border bg-muted/40" />
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => {
                const noFilter = !filterText.trim();
                const isNewRow = noFilter && i >= rows.length;
                const isSelected = selectedRowIndex === i;
                const isDeleted = noFilter && deletedRows.includes(i);
                return (
                <ContextMenu key={i}>
                  <ContextMenuTrigger asChild>
                    <tr 
                      onClick={() => setSelectedRowIndex(i)}
                      className={`group border-b border-border transition-colors ${
                        isDeleted ? 'bg-destructive/30 line-through text-destructive' :
                        isSelected ? 'bg-primary text-primary-foreground' : 
                        isNewRow ? 'bg-green-500/10 hover:bg-muted/60' : 'hover:bg-muted/60'
                      }`}
                    >
                  <td className={`px-2 py-1 text-center text-[11px] border-r border-border select-none ${
                    isSelected ? 'bg-transparent text-primary-foreground' : 
                    isDeleted ? 'bg-destructive/20 text-destructive' : 'text-muted-foreground bg-muted/40'
                  }`}>
                    {isNewRow ? '+' : i + 1}
                  </td>
                  {columns.map(col => {
                    const stagedVal = stagedChanges[i]?.[col];
                    const hasStaged = stagedVal !== undefined;
                    const val = hasStaged ? stagedVal : row[col];
                    const isNull = val === null || val === undefined;
                    const isEditing = editingCell?.rowIndex === i && editingCell?.colName === col;

                    return (
                      <td
                        key={col}
                        onDoubleClick={() => startEdit(i, col, val)}
                        style={{ width: colWidths[col] || 200, minWidth: colWidths[col] || 100, maxWidth: colWidths[col] || 600 }}
                        className={`border-r border-zinc-800/50 whitespace-nowrap truncate cursor-cell transition-colors ${
                          hasStaged && !isSelected ? "bg-yellow-500/20 text-yellow-200" : ""
                        } ${hasStaged && isSelected ? "text-yellow-200 font-bold" : ""} ${isEditing ? "px-3 py-1" : "px-3 py-1"}`}
                      >
                        {isEditing ? (
                        <div className="flex items-center min-h-[24px]">
                          {getEditorType(col) === 'boolean' ? (
                            <input 
                              autoFocus
                              type="checkbox"
                              className="w-3.5 h-3.5 accent-blue-500 cursor-pointer outline-none"
                              checked={editValue === "1" || editValue === "true"}
                              onChange={(e) => setEditValue(e.target.checked ? "1" : "0")}
                              onBlur={saveEdit}
                              onKeyDown={handleEditKeyDown}
                            />
                          ) : getEditorType(col) === 'datetime' ? (
                            <Popover>
                              <PopoverTrigger 
                                className={cn(
                                  "flex w-full items-center justify-between bg-transparent text-foreground outline-none border-b-2 border-primary p-0 text-left",
                                  !editValue && "text-muted-foreground italic"
                                )}
                              >
                                {editValue ? (
                                  !isNaN(new Date(editValue).getTime()) 
                                    ? format(new Date(editValue), "yyyy-MM-dd HH:mm") 
                                    : editValue
                                ) : <span>Pick date & time</span>}
                                <CalendarIcon className="h-3.5 w-3.5 opacity-50" />
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 z-50 bg-popover border-border" align="start">
                                <Calendar
                                  mode="single"
                                  selected={editValue && !isNaN(new Date(editValue).getTime()) ? new Date(editValue) : undefined}
                                  onSelect={(d) => {
                                    if (d) {
                                      const currentTimeStr = editValue && !isNaN(new Date(editValue).getTime()) 
                                        ? format(new Date(editValue), "HH:mm:ss") 
                                        : "00:00:00";
                                      setEditValue(`${format(d, "yyyy-MM-dd")} ${currentTimeStr}`);
                                    }
                                  }}
                                  autoFocus
                                  className="text-foreground"
                                />
                                <div className="p-3 border-t border-border flex items-center justify-between gap-2">
                                  <div className="flex flex-col gap-1 w-full">
                                    <span className="text-xs text-muted-foreground font-medium ml-1">Time</span>
                                    <input 
                                      type="time"
                                      step="1"
                                      className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                                      value={editValue && !isNaN(new Date(editValue).getTime()) ? format(new Date(editValue), "HH:mm:ss") : "00:00:00"}
                                      onChange={(e) => {
                                        const timeStr = e.target.value;
                                        const currentDateStr = editValue && !isNaN(new Date(editValue).getTime()) 
                                          ? format(new Date(editValue), "yyyy-MM-dd") 
                                          : format(new Date(), "yyyy-MM-dd");
                                        setEditValue(`${currentDateStr} ${timeStr}`);
                                      }}
                                    />
                                  </div>
                                  <Button onClick={saveEdit} size="sm" className="mt-5">OK</Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <input 
                              autoFocus
                              type={getEditorType(col) === 'number' ? 'number' : 'text'}
                              className="bg-transparent text-foreground outline-none border-b-2 border-primary placeholder:text-muted-foreground p-0"
                              style={{ 
                                minWidth: "100%", 
                                width: `${Math.max(String(val || "").length, 10)}ch` 
                              }}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={saveEdit}
                              onKeyDown={handleEditKeyDown}
                              placeholder={isNull ? "NULL" : ""}
                            />
                          )}
                        </div>
                      ) : isNull ? (
                        <span className="text-muted-foreground italic">NULL</span>
                      ) : typeof val === 'object' ? (
                        <span className="text-foreground">{JSON.stringify(val)}</span>
                      ) : (
                        <span className={hasStaged ? "text-yellow-600 dark:text-yellow-200" : "text-foreground"}>{String(val)}</span>
                      )}
                      </td>
                    );
                  })}
                  <td className="w-8 border-r border-border" />
                    </tr>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56 bg-popover border-border text-popover-foreground">
                    <ContextMenuItem 
                      onClick={() => {
                        const obj: any = {};
                        columns.forEach(c => { obj[c] = row[c] ?? null; });
                        navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
                        toast.success("Row copied as JSON");
                      }}
                      className="focus:bg-accent focus:text-accent-foreground cursor-pointer"
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
                        navigator.clipboard.writeText(`INSERT INTO \`${tableName}\` (${cols}) VALUES (${vals});`);
                        toast.success("Row copied as SQL");
                      }}
                      className="focus:bg-accent focus:text-accent-foreground cursor-pointer"
                    >
                      Copy Row as SQL INSERT
                    </ContextMenuItem>
                    {!isNewRow && pkCol && (
                      <>
                        <ContextMenuSeparator className="bg-border" />
                        <ContextMenuItem 
                          onClick={() => {
                            if (!deletedRows.includes(i)) setDeletedRows(prev => [...prev, i]);
                            else setDeletedRows(prev => prev.filter(idx => idx !== i));
                          }}
                          className="focus:bg-destructive focus:text-destructive-foreground text-destructive cursor-pointer"
                        >
                          {deletedRows.includes(i) ? "Restore Row" : "Delete Row"}
                        </ContextMenuItem>
                      </>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              )})}
            </tbody>
          </table>
          {hasMore && !filterText.trim() && (
            <div className="p-4 flex justify-center border-t border-zinc-800/50">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadMore}
                className="bg-popover border-border text-popover-foreground hover:bg-accent hover:text-accent-foreground"
              >
                Load Next {LIMIT} Rows
              </Button>
            </div>
          )}
          <div className="p-3 border-t border-zinc-800/50">
            <button 
              onClick={() => setNewRows(prev => [...prev, {}])}
              className="flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors px-2 py-1.5 rounded-lg hover:bg-primary/10"
            >
              <Plus className="w-4 h-4" /> Add Row
            </button>
          </div>
          </div>
        </div>
      ) : (
        <SchemaGrid schema={schema} />
      )}
      
      {/* Bottom Status Bar */}
      <div className={`h-8 flex items-center px-4 text-xs font-medium justify-between transition-colors ${numChanges > 0 ? 'bg-yellow-600 text-white' : 'bg-primary'}`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveTab('data')}
            className={`px-2 py-1 rounded-lg transition-colors ${activeTab === 'data' ? 'bg-white/20' : 'hover:bg-white/10 text-white/80'}`}
          >
            Data
          </button>
          <button 
            onClick={() => setActiveTab('structure')}
            className={`px-2 py-1 rounded-lg transition-colors ${activeTab === 'structure' ? 'bg-white/20' : 'hover:bg-white/10 text-white/80'}`}
          >
            Structure
          </button>
          {/* <button className="hover:bg-white/10 px-2 py-1 rounded-lg transition-colors flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Row
          </button> */}
        </div>
        
        <div className="flex items-center gap-4">
          {numChanges > 0 && (
            <div className="flex items-center gap-3">
              <span className="font-semibold">{numChanges} unsaved change(s)</span>
              <button 
                onClick={commitChanges}
                disabled={isCommitting}
                className="flex items-center gap-1.5 bg-white text-yellow-700 hover:bg-zinc-100 px-3 py-1 rounded-sm transition-colors shadow-sm disabled:opacity-50"
              >
                {isCommitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Commit (Ctrl+S)
              </button>
            </div>
          )}
          {!numChanges && <span>{rows.length} rows</span>}
        </div>

        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-1 hover:bg-white/10 px-2 py-1 rounded-lg transition-colors"
          >
            <Download className="w-3 h-3" />
            Export...
          </button>
        </div>
      </div>

      {exportModalOpen && (
        <ExportTableModal 
          connId={connId} 
          tableName={tableName} 
          columns={columns} 
          rows={filteredRows} 
          onClose={() => setExportModalOpen(false)} 
        />
      )}
    </div>
  );
}
