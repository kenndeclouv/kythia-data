import { useState } from "react";
import { X, Plus, Loader2, Database } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useGamification } from "../../hooks/useGamification";

interface CreateDatabaseModalProps {
  connId: string;
  onClose: () => void;
  onSuccess: (dbName: string) => void;
}

import { CHARSETS, COLLATIONS } from "../../lib/mysql-collations";

export default function CreateDatabaseModal({ connId, onClose, onSuccess }: CreateDatabaseModalProps) {
  const { unlockAchievement } = useGamification();
  const [dbName, setDbName] = useState("");
  const [charset, setCharset] = useState("");
  const [collation, setCollation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!dbName.trim()) {
      toast.error("Database name is required");
      return;
    }

    setIsSubmitting(true);
    let sql = `CREATE DATABASE \`${dbName.trim()}\``;
    
    if (charset) {
      sql += ` CHARACTER SET ${charset}`;
    }
    
    if (collation && charset) {
      // Collation is only valid if charset is set and matches
      sql += ` COLLATE ${collation}`;
    }

    try {
      await invoke("execute_raw_sql", { connId, sql });
      toast.success(`Database '${dbName}' created successfully!`);
      unlockAchievement('data_architect');
      onSuccess(dbName.trim());
    } catch (e: any) {
      toast.error(`Failed to create database: ${e}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1a1a1a] border border-zinc-800 rounded-xl shadow-2xl w-[450px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#141414]">
          <div className="flex items-center gap-2 text-zinc-100">
            <Database className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Create Database</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Database Name <span className="text-red-500">*</span></label>
            <Input 
              autoFocus
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              placeholder="e.g. my_new_database"
              className="bg-[#141414] border-zinc-800 focus-visible:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Character Set</label>
            <Select 
              value={charset} 
              onValueChange={(val) => {
                setCharset(val);
                setCollation(""); // Reset collation when charset changes
              }}
            >
              <SelectTrigger className="w-full bg-[#141414] border-zinc-800">
                <SelectValue placeholder="Default" />
              </SelectTrigger>
              <SelectContent>
                {CHARSETS.map(c => (
                  <SelectItem key={c.label} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Collation</label>
            <Select 
              value={collation} 
              onValueChange={setCollation}
              disabled={!charset} // Only enable if charset is selected
            >
              <SelectTrigger className="w-full bg-[#141414] border-zinc-800">
                <SelectValue placeholder={charset ? "Default for charset" : "Select a charset first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Default</SelectItem>
                {charset && COLLATIONS[charset]?.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-[#141414] flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary hover:bg-primary/90 min-w-[100px]">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            {isSubmitting ? "" : "Create"}
          </Button>
        </div>

      </div>
    </div>
  );
}
