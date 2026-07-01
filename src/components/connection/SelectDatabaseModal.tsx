import { useState } from "react";
import { Search } from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Button } from "../ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";

import { SiMysql } from "react-icons/si";
// import { SiMariadb } from "react-icons/si";

interface DatabaseOption {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
}

const DATABASES: DatabaseOption[] = [
  { id: "mysql", name: "MySQL", icon: SiMysql, color: "bg-[#4479A1]" },
];

export default function SelectDatabaseModal() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("mysql");

  const filtered = DATABASES.filter((db) => db.name.toLowerCase().includes(search.toLowerCase()));

  const handleClose = () => {
    getCurrentWebviewWindow().close();
  };

  const handleCreate = (dbId: string) => {
    new WebviewWindow(`create-connection-${Date.now()}`, {
      url: `/#/create-connection/${dbId}`,
      title: `Create Connection - ${dbId}`,
      width: 640,
      height: 700,
      center: true,
    });
    getCurrentWebviewWindow().close();
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      {/* Search Header */}
      <div className="p-4 border-b border-border app-region-drag">
        <div className="w-full app-region-no-drag">
          <InputGroup>
            <InputGroupInput
              placeholder="Search for databases..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <InputGroupAddon>
              <Search className="w-4 h-4 text-muted-foreground" />
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>

      {/* Grid Area */}
      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-background">
        <div className="grid grid-cols-7 gap-y-8 gap-x-2">
          {filtered.map((db) => (
            <button
              key={db.id}
              onClick={() => setSelectedId(db.id)}
              onDoubleClick={() => handleCreate(db.id)}
              className={`flex flex-col items-center p-2 rounded-lg transition-colors border ${selectedId === db.id ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted/50"
                }`}
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-2 ${db.color}`}>
                <db.icon className="w-8 h-8 text-white" />
              </div>
              <span className="text-xs text-muted-foreground text-center leading-tight">
                {db.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="bg-card px-6 py-4 border-t border-border flex justify-between">
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <div className="flex gap-3">
          {/* <Button variant="secondary">Import Connection</Button>
          <Button variant="secondary">New group</Button> */}
          <Button onClick={() => handleCreate(selectedId)}>Create</Button>
        </div>
      </div>
    </div>
  );
}
