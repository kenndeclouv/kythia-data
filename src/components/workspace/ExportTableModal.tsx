import { useState } from "react";
import { X, Download, Loader2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useGamification } from "../../hooks/useGamification";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface ExportTableModalProps {
  connId: string;
  tableName: string;
  columns: string[];
  rows: any[];
  onClose: () => void;
}

export default function ExportTableModal({ connId, tableName, columns, rows, onClose }: ExportTableModalProps) {
  const { unlockAchievement } = useGamification();
  const [fileName, setFileName] = useState(`${tableName}_export`);
  const [activeTab, setActiveTab] = useState("csv");
  const [isExporting, setIsExporting] = useState(false);

  // CSV Options
  const [csvIncludeHeader, setCsvIncludeHeader] = useState(true);
  const [csvNullToEmpty, setCsvNullToEmpty] = useState(true);
  const [csvDelimiter, setCsvDelimiter] = useState(",");

  // JSON Options
  const [jsonFormat, setJsonFormat] = useState("pretty");

  // SQL Options
  const [sqlDropTable, setSqlDropTable] = useState(false);
  const [sqlIncludeStructure, setSqlIncludeStructure] = useState(true);
  const [sqlIncludeData, setSqlIncludeData] = useState(true);

  const saveFile = async (content: string, extension: string, mimeType: string) => {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${fileName}.${extension}`,
        types: [{ description: `${extension.toUpperCase()} File`, accept: { [mimeType]: [`.${extension}`] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      toast.success(`Table exported successfully!`);
      unlockAchievement("data_exporter");
      onClose();
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `${fileName}.${extension}`; a.click();
        URL.revokeObjectURL(url);
        toast.success("Export successful!");
        onClose();
      }
    }
  };

  const exportCSV = async () => {
    const escape = (v: any) => {
      if (v === null || v === undefined) return csvNullToEmpty ? "" : "NULL";
      const s = String(v);
      const delim = csvDelimiter === "\\t" ? "\t" : csvDelimiter;
      return s.includes(delim) || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    let content = "";
    const delim = csvDelimiter === "\\t" ? "\t" : csvDelimiter;
    
    if (csvIncludeHeader) {
      content += columns.join(delim) + "\n";
    }
    content += rows.map(r => columns.map(c => escape(r[c])).join(delim)).join("\n");
    await saveFile(content, "csv", "text/csv");
  };

  const exportJSON = async () => {
    const data = rows.map(r => { const o: any = {}; columns.forEach(c => { o[c] = r[c] ?? null; }); return o; });
    const content = jsonFormat === "pretty" ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await saveFile(content, "json", "application/json");
  };

  const exportSQL = async () => {
    setIsExporting(true);
    let content = `-- Exported from Kythia Data\n-- Table: ${tableName}\n\n`;

    try {
      if (sqlDropTable) {
        content += `DROP TABLE IF EXISTS \`${tableName}\`;\n\n`;
      }

      if (sqlIncludeStructure) {
        // Fetch CREATE TABLE
        const res: any = await invoke("execute_raw_sql", { connId, sql: `SHOW CREATE TABLE \`${tableName}\`` });
        if (res && res.rows && res.rows.length > 0) {
          const createTableStmt = res.rows[0]["Create Table"] || res.rows[0]["Create View"];
          if (createTableStmt) {
            content += `${createTableStmt};\n\n`;
          }
        }
      }

      if (sqlIncludeData && rows.length > 0) {
        const cols = columns.map(c => `\`${c}\``).join(", ");
        const inserts = rows.map(row => {
          const vals = columns.map(c => {
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
          return `INSERT INTO \`${tableName}\` (${cols}) VALUES (${vals});`;
        }).join("\n");
        content += `${inserts}\n`;
      }

      await saveFile(content, "sql", "application/sql");
    } catch (e: any) {
      toast.error(`Export failed: ${e}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = () => {
    if (activeTab === "csv") exportCSV();
    else if (activeTab === "json") exportJSON();
    else if (activeTab === "sql") exportSQL();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1a1a1a] border border-zinc-800 rounded-xl shadow-2xl w-[500px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#141414]">
          <h2 className="text-lg font-semibold text-zinc-100">Export Result</h2>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-zinc-300 w-24">File name:</label>
            <Input 
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="flex-1 bg-[#141414] border-zinc-800 focus-visible:ring-primary"
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-[#141414] border border-zinc-800 p-1 w-full justify-start rounded-md">
              <TabsTrigger value="csv" className="text-xs data-[state=active]:bg-zinc-800 px-4">CSV</TabsTrigger>
              <TabsTrigger value="json" className="text-xs data-[state=active]:bg-zinc-800 px-4">JSON</TabsTrigger>
              <TabsTrigger value="sql" className="text-xs data-[state=active]:bg-zinc-800 px-4">SQL</TabsTrigger>
            </TabsList>
            
            <div className="mt-4 p-4 border border-zinc-800 rounded-md bg-[#141414]/50 space-y-4">
              
              <TabsContent value="csv" className="m-0 space-y-4 outline-none">
                <div className="flex items-center gap-2">
                  <Switch checked={csvIncludeHeader} onCheckedChange={setCsvIncludeHeader} id="csv-header" />
                  <label htmlFor="csv-header" className="text-sm text-zinc-300 cursor-pointer">Put field names in the first row</label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={csvNullToEmpty} onCheckedChange={setCsvNullToEmpty} id="csv-null" />
                  <label htmlFor="csv-null" className="text-sm text-zinc-300 cursor-pointer">Convert NULL to EMPTY</label>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <label className="text-sm text-zinc-300">Delimiter</label>
                  <Select value={csvDelimiter} onValueChange={setCsvDelimiter}>
                    <SelectTrigger className="w-32 bg-[#1a1a1a] border-zinc-800 text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=",">Comma (,)</SelectItem>
                      <SelectItem value=";">Semicolon (;)</SelectItem>
                      <SelectItem value="\t">Tab</SelectItem>
                      <SelectItem value="|">Pipe (|)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="json" className="m-0 space-y-4 outline-none">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-zinc-300">Format</label>
                  <Select value={jsonFormat} onValueChange={setJsonFormat}>
                    <SelectTrigger className="w-32 bg-[#1a1a1a] border-zinc-800 text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pretty">Pretty Print</SelectItem>
                      <SelectItem value="minified">Minified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="sql" className="m-0 space-y-4 outline-none">
                <div className="flex items-center gap-2">
                  <Switch checked={sqlDropTable} onCheckedChange={setSqlDropTable} id="sql-drop" />
                  <label htmlFor="sql-drop" className="text-sm text-zinc-300 cursor-pointer">Add DROP TABLE IF EXISTS</label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={sqlIncludeStructure} onCheckedChange={setSqlIncludeStructure} id="sql-struct" />
                  <label htmlFor="sql-struct" className="text-sm text-zinc-300 cursor-pointer">Include Structure (CREATE TABLE)</label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={sqlIncludeData} onCheckedChange={setSqlIncludeData} id="sql-data" />
                  <label htmlFor="sql-data" className="text-sm text-zinc-300 cursor-pointer">Include Data (INSERT INTO)</label>
                </div>
              </TabsContent>

            </div>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-[#141414] flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting} className="bg-primary hover:bg-primary/90 min-w-[100px]">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {isExporting ? "" : "Export..."}
          </Button>
        </div>

      </div>
    </div>
  );
}
