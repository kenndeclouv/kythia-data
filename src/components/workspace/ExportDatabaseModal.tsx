import { useState, useEffect } from "react";
import { Download, Loader2, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useGamification } from "../../hooks/useGamification";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface TableSelection {
  name: string;
  structure: boolean;
  data: boolean;
}

interface ExportDatabaseModalProps {
  connId: string;
  dbName: string;
  tables: any[];
  onClose: () => void;
}

export default function ExportDatabaseModal({ connId, dbName, tables, onClose }: ExportDatabaseModalProps) {
  const { unlockAchievement } = useGamification();
  const [fileName, setFileName] = useState(`${dbName}_export`);
  const [isExporting, setIsExporting] = useState(false);
  const [selections, setSelections] = useState<TableSelection[]>([]);

  useEffect(() => {
    setSelections(tables.map(t => ({ name: t.name, structure: true, data: true })));
  }, [tables]);

  const allStructureChecked = selections.length > 0 && selections.every(s => s.structure);
  const allDataChecked = selections.length > 0 && selections.every(s => s.data);
  const allTablesChecked = selections.length > 0 && selections.every(s => s.structure && s.data);

  const toggleAllTables = (checked: boolean) => {
    setSelections(selections.map(s => ({ ...s, structure: checked, data: checked })));
  };

  const toggleAllStructure = (checked: boolean) => {
    setSelections(selections.map(s => ({ ...s, structure: checked })));
  };

  const toggleAllData = (checked: boolean) => {
    setSelections(selections.map(s => ({ ...s, data: checked })));
  };

  const toggleSelection = (idx: number, field: 'structure' | 'data', checked: boolean) => {
    const newSel = [...selections];
    newSel[idx][field] = checked;
    setSelections(newSel);
  };

  const toggleRow = (idx: number, checked: boolean) => {
    const newSel = [...selections];
    newSel[idx].structure = checked;
    newSel[idx].data = checked;
    setSelections(newSel);
  };

  const saveFile = async (content: string, extension: string, mimeType: string) => {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${fileName}.${extension}`,
        types: [{ description: `${extension.toUpperCase()} File`, accept: { [mimeType]: [`.${extension}`] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      toast.success("Database export successful!");
      unlockAchievement("data_exporter");
      onClose();
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `${fileName}.${extension}`; a.click();
        URL.revokeObjectURL(url);
        toast.success("Database export successful!");
        onClose();
      }
    }
  };

  const exportSQL = async () => {
    setIsExporting(true);
    let content = `-- Exported from Kythia Data\n-- Database Export\n\n`;

    try {
      for (const sel of selections) {
        if (!sel.structure && !sel.data) continue;

        content += `-- --------------------------------------------------------\n`;
        content += `-- Table: ${sel.name}\n`;
        content += `-- --------------------------------------------------------\n\n`;

        if (sel.structure) {
          content += `DROP TABLE IF EXISTS \`${sel.name}\`;\n\n`;
          const res: any = await invoke("execute_raw_sql", { connId, sql: `SHOW CREATE TABLE \`${sel.name}\`` });
          if (res && res.rows && res.rows.length > 0) {
            const createTableStmt = res.rows[0]["Create Table"] || res.rows[0]["Create View"];
            if (createTableStmt) {
              content += `${createTableStmt};\n\n`;
            }
          }
        }

        if (sel.data) {
          // Fetch all data (this is a simplified bulk fetch for export)
          const dataRes: any = await invoke("execute_raw_sql", { connId, sql: `SELECT * FROM \`${sel.name}\`` });
          if (dataRes && dataRes.rows && dataRes.rows.length > 0) {
            const cols = dataRes.columns.map((c: string) => `\`${c}\``).join(", ");
            const inserts = dataRes.rows.map((row: any) => {
              const vals = dataRes.columns.map((c: string) => {
                const v = row[c];
                if (v === null || v === undefined) return "NULL";
                if (typeof v === "number" || typeof v === "boolean") return v;
                const str = String(v)
                  .replace(/\\/g, "\\\\")
                  .replace(/'/g, "\\'")
                  .replace(/\n/g, "\\n")
                  .replace(/\r/g, "\\r");
                return `'${str}'`;
              }).join(", ");
              return `INSERT INTO \`${sel.name}\` (${cols}) VALUES (${vals});`;
            }).join("\n");
            content += `${inserts}\n\n`;
          }
        }
      }

      await saveFile(content, "sql", "application/sql");
    } catch (e: any) {
      toast.error(`Database Export failed: ${e}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1a1a1a] border border-zinc-800 rounded-xl shadow-2xl w-[700px] max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#141414] flex-shrink-0">
          <h2 className="text-lg font-semibold text-zinc-100">Export Database (SQL)</h2>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-zinc-300 w-24">File name:</label>
            <Input 
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="flex-1 bg-[#141414] border-zinc-800 focus-visible:ring-primary"
            />
          </div>

          <div className="border border-zinc-800 rounded-md overflow-hidden bg-[#141414]/50">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#1a1a1a] border-b border-zinc-800">
                <tr>
                  <th className="px-4 py-2 font-medium text-zinc-300 w-full">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleAllTables(!allTablesChecked)}>
                      <input 
                        type="checkbox" 
                        className="rounded border-zinc-700 bg-[#141414] accent-primary w-4 h-4"
                        checked={allTablesChecked}
                        readOnly
                      />
                      <span>Tables</span>
                    </div>
                  </th>
                  <th className="px-4 py-2 font-medium text-zinc-300 whitespace-nowrap border-l border-zinc-800 text-center">
                    <div className="flex items-center justify-center gap-2 cursor-pointer" onClick={() => toggleAllStructure(!allStructureChecked)}>
                      <input 
                        type="checkbox" 
                        className="rounded border-zinc-700 bg-[#141414] accent-primary w-4 h-4"
                        checked={allStructureChecked}
                        readOnly
                      />
                      <span>Structure</span>
                    </div>
                  </th>
                  <th className="px-4 py-2 font-medium text-zinc-300 whitespace-nowrap border-l border-zinc-800 text-center">
                    <div className="flex items-center justify-center gap-2 cursor-pointer" onClick={() => toggleAllData(!allDataChecked)}>
                      <input 
                        type="checkbox" 
                        className="rounded border-zinc-700 bg-[#141414] accent-primary w-4 h-4"
                        checked={allDataChecked}
                        readOnly
                      />
                      <span>Data</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {selections.map((sel, idx) => (
                  <tr key={sel.name} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2 text-zinc-300">
                      <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleRow(idx, !(sel.structure && sel.data))}>
                        <input 
                          type="checkbox" 
                          className="rounded border-zinc-700 bg-[#141414] accent-primary w-4 h-4"
                          checked={sel.structure && sel.data}
                          readOnly
                        />
                        <span>{sel.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 border-l border-zinc-800 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-zinc-700 bg-[#141414] accent-primary w-4 h-4 cursor-pointer"
                        checked={sel.structure}
                        onChange={(e) => toggleSelection(idx, 'structure', e.target.checked)}
                      />
                    </td>
                    <td className="px-4 py-2 border-l border-zinc-800 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-zinc-700 bg-[#141414] accent-primary w-4 h-4 cursor-pointer"
                        checked={sel.data}
                        onChange={(e) => toggleSelection(idx, 'data', e.target.checked)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-[#141414] flex justify-end gap-3 flex-shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={exportSQL} disabled={isExporting} className="bg-primary hover:bg-primary/90 min-w-[100px]">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {isExporting ? "" : "Export Database"}
          </Button>
        </div>

      </div>
    </div>
  );
}
