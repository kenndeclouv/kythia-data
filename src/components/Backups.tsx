import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Archive, Download, Trash2, Plus, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { format } from "date-fns";

interface BackupInfo {
  id: string;
  created_at: number;
  size: number;
}

export function Backups() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null);

  const fetchBackups = async () => {
    setIsLoading(true);
    try {
      const data = await invoke<BackupInfo[]>("list_local_backups");
      setBackups(data);
    } catch (e: any) {
      toast.error(`Failed to load backups: ${e}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    setIsCreating(true);
    try {
      await invoke("create_local_backup");
      toast.success("Backup created successfully!");
      fetchBackups();
    } catch (e: any) {
      toast.error(`Failed to create backup: ${e}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await invoke("restore_local_backup", { id });
      toast.success("Backup restored successfully! Reloading...");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e: any) {
      toast.error(`Failed to restore backup: ${e}`);
    } finally {
      setRestoreConfirmId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete_local_backup", { id });
      toast.success("Backup deleted successfully");
      fetchBackups();
    } catch (e: any) {
      toast.error(`Failed to delete backup: ${e}`);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <TooltipProvider>
    <div className="w-full">
      <div className="max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Data Backups</h1>
            <p className="text-muted-foreground mt-2">Manage your connections, settings, and gamification data.</p>
          </div>
          <Button onClick={handleCreateBackup} disabled={isCreating} className="bg-primary/90 hover:bg-primary text-primary-foreground font-medium rounded-lg px-6 py-5 shadow-[0_0_20px_rgba(var(--primary),0.3)] transition-all hover:shadow-[0_0_30px_rgba(var(--primary),0.5)]">
            {isCreating ? (
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Plus className="mr-2 h-5 w-5" />
            )}
            Create Backup
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto pb-10 custom-scrollbar mt-8">
          <div className="bg-card dark:bg-[#141414] text-card-foreground rounded-2xl border border-border/50 dark:border-zinc-800/60 shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-border/50 dark:border-zinc-800/60 bg-secondary/30 dark:bg-white/[0.02] font-semibold text-sm text-muted-foreground">
              <div className="col-span-4">Backup Name</div>
              <div className="col-span-4">Date Created</div>
              <div className="col-span-3">Size</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>
            
            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center text-center text-muted-foreground">
                <RefreshCw className="h-8 w-8 animate-spin mb-4 opacity-50" />
                <p className="text-lg font-medium text-foreground">Loading backups...</p>
              </div>
            ) : backups.length > 0 ? backups.map((backup) => (
              <div key={backup.id} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-border/10 dark:border-zinc-800/40 hover:bg-accent/50 dark:hover:bg-[#1a1a1a] transition-colors items-center text-sm group">
                <div className="col-span-4 font-medium flex items-center gap-2 text-foreground">
                  <Archive className="w-4 h-4 text-primary" />
                  {backup.id}
                </div>
                <div className="col-span-4 text-muted-foreground">
                  {format(new Date(backup.created_at * 1000), 'PPP p')}
                </div>
                <div className="col-span-3 font-mono text-xs opacity-70 text-muted-foreground">
                  {formatBytes(backup.size)}
                </div>
                <div className="col-span-1 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRestoreConfirmId(backup.id)}
                        className="w-8 h-8 text-blue-500 hover:text-blue-500 hover:bg-blue-500/20"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Restore Backup</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmId(backup.id)}
                        className="w-8 h-8 text-red-500 hover:text-red-500 hover:bg-red-500/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete Backup</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )) : (
              <div className="py-16 flex flex-col items-center justify-center text-center text-muted-foreground">
                <Archive className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-lg font-medium text-foreground">No Backups Yet</p>
                <p className="text-sm mt-1 max-w-md">
                  You haven't created any backups yet. Click the Create Backup button to save your current state.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the backup <strong>{deleteConfirmId}</strong> from your local storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!restoreConfirmId} onOpenChange={(open) => !open && setRestoreConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Backup</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore <strong>{restoreConfirmId}</strong>? This will overwrite your current settings, gamification progress, and connections. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreConfirmId && handleRestore(restoreConfirmId)}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}
