import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Loader2, ShieldAlert, UserPlus, Key, Trash2, X, Shield, Search, Users } from "lucide-react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useGamification } from "../../hooks/useGamification";

interface UserManagementModalProps {
  connId: string;
  onClose: () => void;
}

interface DBUser {
  User: string;
  Host: string;
  plugin: string;
  Select_priv?: string;
  Insert_priv?: string;
  Update_priv?: string;
  Delete_priv?: string;
  Create_priv?: string;
  Drop_priv?: string;
  Grant_priv?: string;
  Super_priv?: string;
  [key: string]: any;
}

const PRIVILEGES_GROUPED = {
  Data: [
    { key: "Select_priv", label: "SELECT" },
    { key: "Insert_priv", label: "INSERT" },
    { key: "Update_priv", label: "UPDATE" },
    { key: "Delete_priv", label: "DELETE" },
    { key: "File_priv", label: "FILE" },
  ],
  Structure: [
    { key: "Create_priv", label: "CREATE" },
    { key: "Alter_priv", label: "ALTER" },
    { key: "Index_priv", label: "INDEX" },
    { key: "Drop_priv", label: "DROP" },
    { key: "Create_tmp_table_priv", label: "CREATE TEMPORARY TABLES" },
    { key: "Show_view_priv", label: "SHOW VIEW" },
    { key: "Create_routine_priv", label: "CREATE ROUTINE" },
    { key: "Alter_routine_priv", label: "ALTER ROUTINE" },
    { key: "Execute_priv", label: "EXECUTE" },
    { key: "Create_view_priv", label: "CREATE VIEW" },
    { key: "Event_priv", label: "EVENT" },
    { key: "Trigger_priv", label: "TRIGGER" },
  ],
  Administration: [
    { key: "Grant_priv", label: "GRANT" },
    { key: "Super_priv", label: "SUPER" },
    { key: "Process_priv", label: "PROCESS" },
    { key: "Reload_priv", label: "RELOAD" },
    { key: "Shutdown_priv", label: "SHUTDOWN" },
    { key: "Show_db_priv", label: "SHOW DATABASES" },
    { key: "Lock_tables_priv", label: "LOCK TABLES" },
    { key: "References_priv", label: "REFERENCES" },
    { key: "Repl_client_priv", label: "REPLICATION CLIENT" },
    { key: "Repl_slave_priv", label: "REPLICATION SLAVE" },
    { key: "Create_user_priv", label: "CREATE USER" },
  ]
};

export default function UserManagementModal({ connId, onClose }: UserManagementModalProps) {
  const { unlockAchievement } = useGamification();
  const [users, setUsers] = useState<DBUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [activeTab, setActiveTab] = useState<"list" | "add">("list");
  const [search, setSearch] = useState("");

  // Add User State
  const [newUsername, setNewUsername] = useState("");
  const [newHost, setNewHost] = useState("%");
  const [newPassword, setNewPassword] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Edit State
  const [editingUser, setEditingUser] = useState<DBUser | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editPrivs, setEditPrivs] = useState<Record<string, boolean>>({});

  // Password Change State
  const [passwordUser, setPasswordUser] = useState<DBUser | null>(null);
  const [updatePassword, setUpdatePassword] = useState("");
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  // Delete State
  const [deletingUser, setDeletingUser] = useState<DBUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    setAccessDenied(false);
    try {
      const res: any = await invoke("execute_raw_sql", {
        connId,
        sql: "SELECT * FROM mysql.user",
      });
      setUsers(res.rows as DBUser[]);
    } catch (e: any) {
      setAccessDenied(true);
      if (e.toString().toLowerCase().includes("denied")) {
        unlockAchievement("access_denied");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return toast.error("Username is required");

    setIsAdding(true);
    try {
      let sql = `CREATE USER '${newUsername}'@'${newHost}'`;
      if (newPassword) {
        sql += ` IDENTIFIED BY '${newPassword}'`;
      }
      await invoke("execute_raw_sql", { connId, sql });
      await invoke("execute_raw_sql", { connId, sql: "FLUSH PRIVILEGES" });

      toast.success(`User '${newUsername}'@'${newHost}' created successfully!`);
      setActiveTab("list");
      setNewUsername("");
      setNewHost("%");
      setNewPassword("");
      loadUsers();
    } catch (e: any) {
      toast.error(`Failed to create user: ${e}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      const sql = `DROP USER '${deletingUser.User}'@'${deletingUser.Host}'`;
      await invoke("execute_raw_sql", { connId, sql });
      await invoke("execute_raw_sql", { connId, sql: "FLUSH PRIVILEGES" });

      toast.success(`User '${deletingUser.User}' deleted successfully!`);
      setDeletingUser(null);
      loadUsers();
    } catch (e: any) {
      toast.error(`Failed to delete user: ${e}`);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUser) return;

    setIsChangingPwd(true);
    try {
      const sql = `ALTER USER '${passwordUser.User}'@'${passwordUser.Host}' IDENTIFIED BY '${updatePassword}'`;
      await invoke("execute_raw_sql", { connId, sql });
      await invoke("execute_raw_sql", { connId, sql: "FLUSH PRIVILEGES" });

      toast.success(`Password updated for '${passwordUser.User}'!`);
      unlockAchievement("security_guard");
      setPasswordUser(null);
      setUpdatePassword("");
    } catch (e: any) {
      toast.error(`Failed to update password: ${e}`);
    } finally {
      setIsChangingPwd(false);
    }
  };

  const handleUpdatePrivileges = async () => {
    if (!editingUser) return;
    setIsEditing(true);
    try {
      const privUpdates = Object.entries(editPrivs).map(([key, granted]) => {
        let label = "";
        for (const group of Object.values(PRIVILEGES_GROUPED)) {
          const found = group.find(p => p.key === key);
          if (found) {
            label = found.label;
            break;
          }
        }
        if (!label) return null;
        return granted
          ? `GRANT ${label} ON *.* TO '${editingUser.User}'@'${editingUser.Host}'`
          : `REVOKE ${label} ON *.* FROM '${editingUser.User}'@'${editingUser.Host}'`;
      }).filter(Boolean);

      for (const sql of privUpdates) {
        await invoke("execute_raw_sql", { connId, sql });
      }

      await invoke("execute_raw_sql", { connId, sql: "FLUSH PRIVILEGES" });
      toast.success("Privileges updated successfully!");
      unlockAchievement("security_guard");
      setEditingUser(null);
      setEditPrivs({});
      loadUsers();
    } catch (e: any) {
      toast.error(`Failed to update privileges: ${e}`);
    } finally {
      setIsEditing(false);
    }
  };

  const filteredUsers = users.filter(u => u.User.toLowerCase().includes(search.toLowerCase()) || u.Host.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">User Management</h2>
              <p className="text-sm text-zinc-400">Manage database users and global privileges</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col bg-zinc-950/50">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
              <p className="text-zinc-400">Fetching user data...</p>
            </div>
          ) : accessDenied ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20">
                <ShieldAlert className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-zinc-100 mb-2">Access Denied</h3>
              <p className="text-zinc-400 text-sm">
                Your current connection does not have sufficient privileges to view or manage database users.
              </p>
              <Button onClick={onClose} className="mt-6 bg-zinc-800 hover:bg-zinc-700 text-white">
                Close
              </Button>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
              <div className="!px-6 py-2 bg-zinc-900 border-b border-zinc-800">
                <TabsList className="bg-zinc-950/50 border border-zinc-800/50 p-1">
                  <TabsTrigger value="list" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none px-4">
                    <Users className="w-4 h-4 mr-2" />
                    Users List
                  </TabsTrigger>
                  <TabsTrigger value="add" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-none px-4">
                    <UserPlus className="w-4 h-4 mr-2" /> Add New User
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="list" className="flex-1 overflow-hidden flex flex-col m-0 data-[state=active]:flex">
                <div className="p-4 border-b border-zinc-800 flex items-center gap-2 bg-zinc-900/30">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search users or hosts..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-1.5 pl-9 pr-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="text-xs text-zinc-500 ml-auto">{filteredUsers.length} users found</div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-sm text-zinc-300">
                    <thead className="bg-zinc-950 border-b border-zinc-800 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 font-medium">User</th>
                        <th className="px-4 py-3 font-medium">Host</th>
                        <th className="px-4 py-3 font-medium">Plugin</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user, i) => (
                        <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-2 text-zinc-100 font-medium">{user.User}</td>
                          <td className="px-4 py-2 text-zinc-400 font-mono text-xs">{user.Host}</td>
                          <td className="px-4 py-2 text-zinc-500 font-mono text-xs">{user.plugin}</td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={() => {
                                setEditingUser(user);
                                const currentPrivs: Record<string, boolean> = {};
                                Object.values(PRIVILEGES_GROUPED).flat().forEach(p => {
                                  currentPrivs[p.key] = user[p.key] === 'Y';
                                });
                                setEditPrivs(currentPrivs);
                              }}>
                                <Shield className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={() => setPasswordUser(user)}>
                                <Key className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-400" onClick={() => setDeletingUser(user)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="add" className="flex-1 overflow-auto custom-scrollbar m-0 p-6 data-[state=active]:flex flex-col">
                <div className="max-w-xl mx-auto w-full">
                  <h3 className="text-lg font-medium text-zinc-100 mb-6">Create New Database User</h3>
                  <form onSubmit={handleAddUser} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-zinc-300">Username <span className="text-red-400">*</span></label>
                      <input type="text" required className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-2 px-3 text-sm text-zinc-200" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-zinc-300">Host</label>
                      <input type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-2 px-3 text-sm text-zinc-200" value={newHost} onChange={e => setNewHost(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-zinc-300">Password</label>
                      <input type="password" className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-2 px-3 text-sm text-zinc-200" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    </div>
                    <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isAdding}>
                      {isAdding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                      Create User
                    </Button>
                  </form>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      <AlertDialog open={!!passwordUser} onOpenChange={() => setPasswordUser(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Change Password</AlertDialogTitle>
          </AlertDialogHeader>
          <form onSubmit={handleChangePassword}>
            <input type="password" required className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-2 px-3 my-4" value={updatePassword} onChange={e => setUpdatePassword(e.target.value)} />
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
              <Button type="submit" disabled={isChangingPwd}>Save Password</Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to drop user {deletingUser?.User}?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDeleteUser()} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editingUser && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur flex flex-col p-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white">Edit privileges</h2>
              <p className="text-zinc-400 text-sm font-mono mt-1">'{editingUser.User}'@'{editingUser.Host}'</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setEditingUser(null)}><X className="w-5 h-5" /></Button>
          </div>

          <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar pr-2">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-800">
                <h3 className="font-semibold flex items-center gap-2 text-zinc-200"><Shield className="w-4 h-4 text-primary" /> Global privileges</h3>
                <Button variant="outline" size="sm" onClick={() => {
                  const allPrivs = Object.values(PRIVILEGES_GROUPED).flat();
                  const allChecked = allPrivs.every(p => editPrivs[p.key]);
                  const newPrivs: Record<string, boolean> = {};
                  allPrivs.forEach(p => newPrivs[p.key] = !allChecked);
                  setEditPrivs(newPrivs);
                }}>Check all</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(PRIVILEGES_GROUPED).map(([groupName, privs]) => (
                  <div key={groupName} className="border border-zinc-800 rounded-lg bg-zinc-950 overflow-hidden">
                    <div className="bg-zinc-900 px-3 py-2 border-b border-zinc-800 flex items-center gap-2">
                      <Checkbox
                        checked={privs.every(p => editPrivs[p.key])}
                        onCheckedChange={(checked) => {
                          const newPrivs = { ...editPrivs };
                          privs.forEach(p => newPrivs[p.key] = !!checked);
                          setEditPrivs(newPrivs);
                        }}
                      />
                      <span className="text-sm font-semibold text-zinc-300">{groupName}</span>
                    </div>
                    <div className="p-3 flex flex-col gap-2">
                      {privs.map(p => (
                        <label key={p.key} className="flex items-center gap-2 cursor-pointer group">
                          <Checkbox
                            checked={!!editPrivs[p.key]}
                            onCheckedChange={(checked) => setEditPrivs({ ...editPrivs, [p.key]: !!checked })}
                          />
                          <span className="text-xs text-zinc-400 group-hover:text-zinc-300 transition-colors">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={handleUpdatePrivileges} disabled={isEditing}>Save Changes</Button>
          </div>
        </div>
      )}
    </div>
  );
}
