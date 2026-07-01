import { useState } from "react";
import { X, Plus, Trash2, Loader2 } from "lucide-react";
import { useGamification } from "../../hooks/useGamification";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface ColumnDef {
  name: string;
  type: string;
  length: string;
  attributes: string;
  isNull: boolean;
  indexType: string;
  isAi: boolean;
  defaultVal: string;
  comment: string;
}

interface CreateTableModalProps {
  connId: string;
  onClose: () => void;
  onSuccess: (tableName: string) => void;
}

const DB_TYPES = [
  { label: "Common", options: ["INT", "VARCHAR", "TEXT", "DATE"] },
  { label: "Numeric", options: ["TINYINT", "SMALLINT", "MEDIUMINT", "INT", "BIGINT", "DECIMAL", "FLOAT", "DOUBLE", "REAL", "BIT", "BOOLEAN", "SERIAL"] },
  { label: "Date and time", options: ["DATE", "DATETIME", "TIMESTAMP", "TIME", "YEAR"] },
  { label: "String", options: ["CHAR", "VARCHAR", "TINYTEXT", "TEXT", "MEDIUMTEXT", "LONGTEXT", "BINARY", "VARBINARY", "TINYBLOB", "BLOB", "MEDIUMBLOB", "LONGBLOB", "ENUM", "SET"] },
  { label: "Spatial", options: ["GEOMETRY", "POINT", "LINESTRING", "POLYGON", "MULTIPOINT", "MULTILINESTRING", "MULTIPOLYGON", "GEOMETRYCOLLECTION"] },
  { label: "JSON", options: ["JSON"] }
];

const ATTRIBUTES = [
  { value: "", label: "---" },
  { value: "BINARY", label: "BINARY" },
  { value: "UNSIGNED", label: "UNSIGNED" },
  { value: "UNSIGNED ZEROFILL", label: "UNSIGNED ZEROFILL" },
  { value: "on update CURRENT_TIMESTAMP", label: "on update CURRENT_TIMESTAMP" },
];

const INDEX_TYPES = [
  { value: "", label: "---" },
  { value: "PRIMARY", label: "PRIMARY" },
  { value: "UNIQUE", label: "UNIQUE" },
  { value: "INDEX", label: "INDEX" },
  { value: "FULLTEXT", label: "FULLTEXT" },
  { value: "SPATIAL", label: "SPATIAL" },
];

export default function CreateTableModal({ connId, onClose, onSuccess }: CreateTableModalProps) {
  const { unlockAchievement } = useGamification();
  const [tableName, setTableName] = useState("");
  const [columns, setColumns] = useState<ColumnDef[]>([
    { name: "id", type: "INT", length: "", attributes: "", isNull: false, indexType: "PRIMARY", isAi: true, defaultVal: "", comment: "" }
  ]);
  const [isCreating, setIsCreating] = useState(false);

  const addColumn = () => {
    setColumns([...columns, { name: "", type: "VARCHAR", length: "255", attributes: "", isNull: true, indexType: "", isAi: false, defaultVal: "", comment: "" }]);
  };

  const removeColumn = (index: number) => {
    if (columns.length === 1) return;
    setColumns(columns.filter((_, i) => i !== index));
  };

  const updateColumn = (index: number, field: keyof ColumnDef, value: any) => {
    const newCols = [...columns];
    newCols[index] = { ...newCols[index], [field]: value };
    setColumns(newCols);
  };

  const handleCreate = async () => {
    if (!tableName.trim()) {
      toast.error("Table name is required");
      return;
    }
    
    if (columns.some(c => !c.name.trim())) {
      toast.error("All columns must have a name");
      return;
    }

    setIsCreating(true);

    let sql = `CREATE TABLE \`${tableName.trim()}\` (\n`;
    const colDefs = columns.map(c => {
      let def = `  \`${c.name.trim()}\` ${c.type}`;
      if (c.length) def += `(${c.length})`;
      if (c.attributes) def += ` ${c.attributes}`;
      if (c.isAi) def += " AUTO_INCREMENT";
      if (!c.isNull) def += " NOT NULL";
      if (c.defaultVal) {
        if (c.defaultVal.toUpperCase() === 'CURRENT_TIMESTAMP') {
          def += ` DEFAULT CURRENT_TIMESTAMP`;
        } else {
          def += ` DEFAULT '${c.defaultVal}'`;
        }
      }
      if (c.comment) {
        def += ` COMMENT '${c.comment.replace(/'/g, "''")}'`;
      }
      return def;
    });

    // Extract Indices
    columns.forEach(c => {
      if (c.indexType === "PRIMARY") {
        colDefs.push(`  PRIMARY KEY (\`${c.name.trim()}\`)`);
      } else if (c.indexType === "UNIQUE") {
        colDefs.push(`  UNIQUE KEY (\`${c.name.trim()}\`)`);
      } else if (c.indexType === "INDEX") {
        colDefs.push(`  INDEX (\`${c.name.trim()}\`)`);
      } else if (c.indexType === "FULLTEXT") {
        colDefs.push(`  FULLTEXT (\`${c.name.trim()}\`)`);
      } else if (c.indexType === "SPATIAL") {
        colDefs.push(`  SPATIAL (\`${c.name.trim()}\`)`);
      }
    });

    sql += colDefs.join(",\n");
    sql += "\n);";

    try {
      await invoke("execute_raw_sql", { connId, sql });
      toast.success(`Table '${tableName}' created successfully!`);
      unlockAchievement('table_wizard');
      onSuccess(tableName.trim());
    } catch (e: any) {
      toast.error(`Failed to create table: ${e}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1a1a1a] border border-zinc-800 rounded-xl shadow-2xl w-[1200px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#141414]">
          <h2 className="text-lg font-semibold text-zinc-100">Create New Table</h2>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="space-y-2 max-w-sm">
            <label className="text-sm font-medium text-zinc-300">Table Name</label>
            <Input 
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="e.g. users"
              className="bg-[#141414] border-zinc-800"
              autoFocus
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-300">Columns</label>
              <Button size="sm" variant="outline" onClick={addColumn} className="h-8 text-xs bg-[#141414] border-zinc-700 hover:bg-zinc-800 text-zinc-300">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Column
              </Button>
            </div>
            
            <div className="bg-[#141414] border border-zinc-800 rounded-lg overflow-x-auto custom-scrollbar pb-2">
              <table className="w-full text-sm text-left min-w-[1000px]">
                <thead className="bg-[#1e1e1e] border-b border-zinc-800 text-zinc-400">
                  <tr>
                    <th className="px-4 py-2 font-medium w-48">Name</th>
                    <th className="px-4 py-2 font-medium w-36">Type</th>
                    <th className="px-4 py-2 font-medium w-24">Length</th>
                    <th className="px-4 py-2 font-medium w-24">Default</th>
                    <th className="px-4 py-2 font-medium w-36">Attributes</th>
                    <th className="px-4 py-2 font-medium w-20 text-center">Null</th>
                    <th className="px-4 py-2 font-medium w-32">Index</th>
                    <th className="px-4 py-2 font-medium w-20 text-center">A_I</th>
                    <th className="px-4 py-2 font-medium w-32">Comments</th>
                    <th className="px-4 py-2 font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {columns.map((col, index) => (
                    <tr key={index} className="hover:bg-zinc-800/20">
                      <td className="px-2 py-2">
                        <Input 
                          value={col.name} 
                          onChange={(e) => updateColumn(index, "name", e.target.value)}
                          placeholder="name"
                          className="h-8 bg-transparent border-transparent hover:border-zinc-700 focus:bg-[#1a1a1a] focus:border-primary text-sm px-2 w-full"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Select value={col.type} onValueChange={(val) => updateColumn(index, "type", val)}>
                          <SelectTrigger className="h-8 w-full bg-transparent border-transparent hover:border-zinc-700 focus:bg-[#1a1a1a] focus:border-primary text-sm px-2">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {DB_TYPES.map((group) => (
                              <SelectGroup key={group.label}>
                                <SelectLabel className="text-zinc-500 font-semibold text-xs uppercase tracking-wider">{group.label}</SelectLabel>
                                {group.options.map((t) => (
                                  <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-2">
                        <Input 
                          value={col.length} 
                          onChange={(e) => updateColumn(index, "length", e.target.value)}
                          placeholder="255"
                          className="h-8 bg-transparent border-transparent hover:border-zinc-700 focus:bg-[#1a1a1a] focus:border-primary text-sm px-2 w-full"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input 
                          value={col.defaultVal} 
                          onChange={(e) => updateColumn(index, "defaultVal", e.target.value)}
                          placeholder="e.g. NULL"
                          className="h-8 bg-transparent border-transparent hover:border-zinc-700 focus:bg-[#1a1a1a] focus:border-primary text-sm px-2 w-full"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Select value={col.attributes} onValueChange={(val) => updateColumn(index, "attributes", val)}>
                          <SelectTrigger className="h-8 w-full bg-transparent border-transparent hover:border-zinc-700 focus:bg-[#1a1a1a] focus:border-primary text-sm px-2">
                            <SelectValue placeholder="---" />
                          </SelectTrigger>
                          <SelectContent>
                            {ATTRIBUTES.map((attr) => (
                              <SelectItem key={attr.label} value={attr.value}>{attr.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Switch 
                          checked={col.isNull} 
                          onCheckedChange={(c) => updateColumn(index, "isNull", c)}
                          className="scale-90"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Select value={col.indexType} onValueChange={(val) => updateColumn(index, "indexType", val)}>
                          <SelectTrigger className="h-8 w-full bg-transparent border-transparent hover:border-zinc-700 focus:bg-[#1a1a1a] focus:border-primary text-sm px-2">
                            <SelectValue placeholder="---" />
                          </SelectTrigger>
                          <SelectContent>
                            {INDEX_TYPES.map((idx) => (
                              <SelectItem key={idx.label} value={idx.value}>{idx.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Switch 
                          checked={col.isAi} 
                          onCheckedChange={(c) => updateColumn(index, "isAi", c)}
                          className="scale-90"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input 
                          value={col.comment} 
                          onChange={(e) => updateColumn(index, "comment", e.target.value)}
                          placeholder="Comment"
                          className="h-8 bg-transparent border-transparent hover:border-zinc-700 focus:bg-[#1a1a1a] focus:border-primary text-sm px-2 w-full"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button 
                          onClick={() => removeColumn(index)}
                          disabled={columns.length === 1}
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-md disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-zinc-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-zinc-800 bg-[#141414] flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating} className="bg-primary hover:bg-primary/90">
            {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Table
          </Button>
        </div>

      </div>
    </div>
  );
}
