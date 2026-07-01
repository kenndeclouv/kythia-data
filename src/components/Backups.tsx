import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Archive, Download, Trash2, Plus, HardDrive, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
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
    <div className="w-full">
      <div className="max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Data Backups</h1>
            <p className="text-zinc-400 mt-2">Manage your connections, settings, and gamification data.</p>
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

        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20">
                <HardDrive className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="font-semibold tracking-wide">Available Backups</CardTitle>
                <CardDescription className="mt-1">
                  Restore from a previous backup point or delete old ones
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                <RefreshCw className="h-8 w-8 animate-spin mb-4 text-zinc-400" />
                <p>Loading backups...</p>
              </div>
            ) : backups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4 ring-1 ring-white/5">
                  <Archive className="h-8 w-8 text-zinc-400" />
                </div>
                <h3 className="text-lg font-medium text-zinc-300 mb-2">No backups found</h3>
                <p className="text-sm text-zinc-500 max-w-sm">
                  You haven't created any backups yet. Click the Create Backup button to save your current state.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-500 py-4 px-6 font-medium">Backup Name</TableHead>
                    <TableHead className="text-zinc-500 py-4 px-6 font-medium">Date Created</TableHead>
                    <TableHead className="text-zinc-500 py-4 px-6 font-medium">Size</TableHead>
                    <TableHead className="text-right text-zinc-500 py-4 px-6 font-medium">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((backup) => (
                    <TableRow key={backup.id} className="border-zinc-800/50 hover:bg-white/[0.02] transition-colors group">
                      <TableCell className="px-6 py-4 font-medium text-zinc-300">
                        {backup.id}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-zinc-400">
                        {format(new Date(backup.created_at * 1000), 'PPP p')}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-zinc-400">
                        {formatBytes(backup.size)}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRestoreConfirmId(backup.id)}
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                          title="Restore"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(backup.id)}
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-400/10"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
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
  );
}
