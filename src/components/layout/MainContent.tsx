import { useState, useEffect } from "react";
import { Search, Database, Trash, Pencil, Plus, Server, Play } from "lucide-react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
// import { Input } from "../ui/input";
// import { Button } from "../ui/button";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
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
import { Button } from "../ui/button";

interface MainContentProps {
  onCreateConnection: () => void;
}

export default function MainContent({ onCreateConnection }: MainContentProps) {
  const [connections, setConnections] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const [isOpeningWorkspace, setIsOpeningWorkspace] = useState(false);

  const fetchConnections = async () => {
    try {
      const data: any[] = await invoke("get_connections");
      setConnections(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchConnections();
    const unlisten = listen("connection-saved", () => {
      fetchConnections();
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const handleEdit = (index: number) => {
    new WebviewWindow(`edit-connection-${Date.now()}`, {
      url: `/#/edit-connection/${index}`,
      title: "Edit Connection",
      width: 640,
      height: 700,
      center: true,
    });
  };

  const handleOpenWorkspace = async (index: number) => {
    if (isOpeningWorkspace) return;
    setIsOpeningWorkspace(true);

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const currentWindow = getCurrentWindow();
      
      const label = `workspace-${index}-${Date.now()}`;
      const workspaceWindow = new WebviewWindow(label, {
        url: `/#/workspace/${index}`,
        title: "Kythia Data - Workspace",
        width: 1248,
        height: 680,
        center: true,
        minWidth: 800,
        minHeight: 600,
      });

      // Handle window creation error
      workspaceWindow.once('tauri://error', async (e) => {
        console.error("Error creating workspace window:", e);
        try { await currentWindow.show(); } catch (_) {}
        setIsOpeningWorkspace(false);
      });

      // Show main window when workspace is closed
      workspaceWindow.once('tauri://destroyed', async () => {
        try {
          await currentWindow.show();
        } catch (e) {
          console.error("Failed to show current window:", e);
        }
        setIsOpeningWorkspace(false);
      });

      // Hide main window immediately
      try {
        await currentWindow.hide();
      } catch (e) {
        console.error("Failed to hide current window:", e);
      }
    } catch (e) {
      console.error("Failed to open workspace:", e);
      setIsOpeningWorkspace(false);
    }
  };

  const confirmDelete = async (index: number) => {
    try {
      await invoke("delete_connection", { index });
      toast.success("Connection deleted!");
      fetchConnections();
    } catch (e: any) {
      toast.error(`Failed to delete connection: ${e}`);
    } finally {
      setDeleteConfirmIndex(null);
    }
  };

  const filteredConnections = connections.filter((conn) =>
    (conn.name && conn.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (conn.host && conn.host.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (conn.user && conn.user.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (conn.tag && conn.tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex-1 flex flex-col bg-transparent text-foreground">

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-10 custom-scrollbar max-w-5xl mx-auto w-full">

        {/* Header Section */}
        <div className="flex flex-col gap-6 mb-10">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">Databases</h1>
              <p className="text-muted-foreground">Manage and connect to your database instances.</p>
            </div>
            <Button onClick={onCreateConnection} className="mt-3 bg-primary/90 hover:bg-primary text-primary-foreground font-medium rounded-lg px-6 py-5 shadow-[0_0_20px_rgba(var(--primary),0.3)] transition-all hover:shadow-[0_0_30px_rgba(var(--primary),0.5)]">
              <Plus className="mr-2 h-5 w-5" />
              New Connection
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search connections by name, host, or tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-secondary/50 dark:bg-[#1a1a1a] border border-border/50 dark:border-zinc-800/80 hover:border-border dark:hover:border-zinc-700 text-sm rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground shadow-sm text-foreground"
            />
          </div>
        </div>

        {/* List Section */}
        {connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border/50 dark:border-zinc-800/50 rounded-2xl bg-card/50 dark:bg-[#141414]/50">
            <div className="w-16 h-16 bg-secondary/30 dark:bg-[#1a1a1a] border border-border/50 dark:border-zinc-800/80 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
              <Database className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">No Connections</h2>
            <p className="text-muted-foreground text-sm text-center max-w-sm mb-6">
              You haven't added any databases yet. Create your first connection to get started.
            </p>
            <Button onClick={onCreateConnection} className="bg-red-600 hover:bg-red-700 text-white border-0 shadow-lg shadow-red-900/20 rounded-lg">
              <Plus className="w-4 h-4 mr-2" />
              New Connection
            </Button>
          </div>
        ) : filteredConnections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Search className="w-10 h-10 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground">No matches found</h3>
            <p className="text-muted-foreground">We couldn't find anything matching "{searchTerm}"</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredConnections.map((conn, i) => (
              <ContextMenu key={i}>
                <ContextMenuTrigger>
                  <div
                    className="group flex items-center justify-between p-4 bg-card dark:bg-[#141414] hover:bg-accent/50 dark:hover:bg-[#1a1a1a] border border-border/50 dark:border-zinc-800/60 hover:border-border dark:hover:border-zinc-700 rounded-xl cursor-pointer transition-all duration-200"
                    onDoubleClick={() => handleOpenWorkspace(i)}
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${conn.color ? `${conn.color} text-white` : "bg-secondary dark:bg-zinc-800/50 text-muted-foreground"
                        }`}>
                        <Server className="w-6 h-6" />
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-base text-foreground transition-colors">
                            {conn.name || conn.host}
                          </h3>
                          {conn.tag && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-secondary dark:bg-zinc-800/80 text-muted-foreground border border-border/50 dark:border-zinc-700/50">
                              {conn.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground font-mono mt-0.5">
                          {conn.user}<span className="text-muted-foreground/50">@</span>{conn.host}<span className="text-muted-foreground/50">:</span>{conn.port}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(i); }}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Edit Connection"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmIndex(i); }}
                        className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete Connection"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                      <div className="w-px h-6 bg-border dark:bg-zinc-800 mx-3" />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenWorkspace(i); }}
                        disabled={isOpeningWorkspace}
                        className={`flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white rounded-lg font-medium text-sm transition-colors shadow-sm ${isOpeningWorkspace ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Play className="w-3.5 h-3.5" />
                        {isOpeningWorkspace ? 'Connecting...' : 'Connect'}
                      </button>
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-56">
                  <ContextMenuItem disabled={isOpeningWorkspace} className="cursor-pointer" onClick={() => handleOpenWorkspace(i)}>
                    <Play className="w-4 h-4 mr-2" />
                    {isOpeningWorkspace ? 'Connecting...' : 'Connect'}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem className="cursor-pointer" onClick={() => handleEdit(i)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit connection...
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer" onClick={() => setDeleteConfirmIndex(i)}>
                    <Trash className="w-4 h-4 mr-2" />
                    Delete connection
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteConfirmIndex !== null} onOpenChange={(open) => !open && setDeleteConfirmIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Connection?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this database connection? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmIndex !== null && confirmDelete(deleteConfirmIndex)}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
