import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { toast } from "sonner";
import { useGamification } from "../../hooks/useGamification";

interface CreateConnectionModalProps {
  onClose?: () => void;
  editIndex?: number;
}

export default function CreateConnectionModal({ editIndex }: CreateConnectionModalProps) {
  const { unlockAchievement, playSoundEffect } = useGamification();
  const [name, setName] = useState("");
  const [tag, setTag] = useState("local");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("3306");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState("");
  const [sslMode, setSslMode] = useState("PREFERRED");
  const [tlsVersion, setTlsVersion] = useState("1.1");
  const [color, setColor] = useState("bg-green-600");
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(editIndex !== undefined);

  useEffect(() => {
    if (editIndex !== undefined) {
      invoke("get_connection", { index: editIndex })
        .then((data: any) => {
          if (data) {
            setName(data.name || "");
            setTag(data.tag || "local");
            setHost(data.host || "");
            setPort(data.port ? data.port.toString() : "3306");
            setUser(data.user || "");
            setPassword(data.password || "");
            setDatabase(data.database || "");
            setSslMode(data.sslMode || "PREFERRED");
            setTlsVersion(data.tlsVersion || "1.1");
            setColor(data.color || "bg-green-600");
          }
        })
        .catch((e) => toast.error(`Failed to load connection: ${e}`))
        .finally(() => setIsLoading(false));
    }
  }, [editIndex]);

  const COLORS = [
    "bg-green-600",
    "bg-green-500",
    "bg-gray-500",
    "bg-blue-500",
    "bg-yellow-600",
    "bg-red-600",
  ];

  const handleClose = () => {
    getCurrentWebviewWindow().close();
  };

  const handleTest = async () => {
    if (!host || !user) {
      toast.error("Host and User are required to test connection.");
      return;
    }
    try {
      setIsTesting(true);
      const payload = { host, port: parseInt(port) || 3306, user, password, database, sslMode };
      await invoke("test_connection", { payload });
      toast.success("Connection successful!");
      playSoundEffect();
      if (user === "root") {
        unlockAchievement("root_access");
      }
    } catch (e: any) {
      toast.error(`Connection failed: ${e}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (connect: boolean) => {
    if (!name || !host || !user) {
      toast.error("Name, Host, and User are required to save.");
      return;
    }
    try {
      setIsSaving(true);
      const payload = { name, tag, host, port: parseInt(port) || 3306, user, password, database, sslMode, tlsVersion, color };
      if (editIndex !== undefined) {
        await invoke("edit_connection", { index: editIndex, payload });
      } else {
        await invoke("save_connection", { payload });
      }
      await emit("connection-saved");
      toast.success(editIndex !== undefined ? "Connection updated!" : "Connection saved!");
      if (connect) {
        handleClose();
      }
    } catch (e: any) {
      toast.error(`Save failed: ${e}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border app-region-drag">
        <div className="flex-1"></div>
        <h2 className="font-semibold text-[15px] flex-1 text-center">
          {editIndex !== undefined ? "Edit Connection" : "MySQL"}
        </h2>
        <div className="flex-1 flex justify-end">
          <Button 
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground app-region-no-drag"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Body Form Area */}
      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-[100px_1fr] gap-y-4 gap-x-4 items-center text-sm">
            
            {/* Name */}
            <label className="text-right text-muted-foreground font-medium">Name</label>
            <Input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Local DB" />

            {/* Status color & Tag */}
            <label className="text-right text-muted-foreground font-medium">Status color</label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                {COLORS.map((c) => (
                  <div
                    key={c}
                    onClick={() => setColor(c)}
                    className={`h-6 rounded-md cursor-pointer transition-all ${c} ${
                      color === c ? "w-12 border-2 border-white/40 opacity-100" : "w-6 opacity-50 hover:opacity-100"
                    }`}
                  ></div>
                ))}
              </div>
              <div className="flex items-center gap-2 w-1/3">
                <label className="text-muted-foreground whitespace-nowrap">Tag</label>
                <Select value={tag} onValueChange={setTag}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">local</SelectItem>
                    <SelectItem value="production">production</SelectItem>
                    <SelectItem value="staging">staging</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Host & Port */}
            <label className="text-right text-muted-foreground font-medium">Host/IP</label>
            <div className="flex gap-4">
              <Input type="text" className="flex-1" value={host} onChange={(e) => setHost(e.target.value)} placeholder="127.0.0.1" />
              <div className="flex items-center gap-2 w-1/3">
                <label className="text-muted-foreground">Port</label>
                <Input type="text" value={port} onChange={(e) => setPort(e.target.value)} placeholder="3306" />
              </div>
            </div>

            {/* User */}
            <label className="text-right text-muted-foreground font-medium">User</label>
            <div className="flex gap-2">
              <Input type="text" className="flex-1" value={user} onChange={(e) => setUser(e.target.value)} placeholder="root" />
            </div>

            {/* Password */}
            <label className="text-right text-muted-foreground font-medium">Password</label>
            <div className="flex gap-2">
              <Input type="password" className="flex-1" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="***" />
            </div>

            {/* Database */}
            <label className="text-right text-muted-foreground font-medium">Database</label>
            <div className="flex gap-2">
              <Input type="text" className="flex-1" value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="Optional" />
              <Button variant="secondary" disabled>
                Bootstrap commands...
              </Button>
            </div>

            {/* SSL Mode */}
            <label className="text-right text-muted-foreground font-medium">SSL mode</label>
            <div className="flex gap-4">
              <Select value={sslMode} onValueChange={setSslMode}>
                <SelectTrigger className="h-9 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PREFERRED">PREFERRED</SelectItem>
                  <SelectItem value="REQUIRED">REQUIRED</SelectItem>
                  <SelectItem value="DISABLED">DISABLED</SelectItem>
                  <SelectItem value="ALLOW">ALLOW</SelectItem>
                  <SelectItem value="VERIFY-CA">VERIFY-CA</SelectItem>
                  <SelectItem value="VERIFY-IDENTITY">VERIFY-IDENTITY</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 w-1/3">
                <label className="text-muted-foreground">TLS</label>
                <Select value={tlsVersion} onValueChange={setTlsVersion}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1.1">TLS 1.1, 1.2</SelectItem>
                    <SelectItem value="1.3">TLS 1.3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* SSL Buttons */}
            <div></div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled>Key...</Button>
              <Button variant="outline" className="flex-1" disabled>Cert...</Button>
              <Button variant="outline" className="flex-1" disabled>CA Cert...</Button>
              <Button variant="outline" disabled>—</Button>
            </div>

          </div>
        )}
      </div>

        {/* Footer Actions */}
        <div className="bg-card px-6 py-4 border-t border-border flex justify-end gap-3">
          <Button variant="secondary" onClick={() => handleSave(false)} disabled={isSaving || isTesting}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save
          </Button>
          <Button variant="secondary" onClick={handleTest} disabled={isSaving || isTesting}>
            {isTesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Test
          </Button>
          <Button onClick={() => handleSave(true)} disabled={isSaving || isTesting}>
            Connect
          </Button>
        </div>
    </div>
  );
}
