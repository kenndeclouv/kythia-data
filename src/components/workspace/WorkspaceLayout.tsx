import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
  Database, Table as TableIcon, LayoutGrid, Search, Loader2,
  ChevronDown, X,
  Sidebar, RefreshCw, Command, Plus, MoreVertical,
  PanelRight
} from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useGamification } from "../../hooks/useGamification";
import DataGrid from "./DataGrid";
import SqlEditor from "./SqlEditor";
import WorkspaceOmnibar from "./WorkspaceOmnibar";
import CreateTableModal from "./CreateTableModal";
import CreateDatabaseModal from "./CreateDatabaseModal";
import ExportDatabaseModal from "./ExportDatabaseModal";
import UserManagementModal from "./UserManagementModal";
import SwitchDatabaseModal from "./SwitchDatabaseModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "../ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "../ui/context-menu";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface WorkspaceTab {
  id: string;
  type: 'table' | 'query';
  title: string;
  isDirty: boolean;
  isPreview: boolean;
  data?: string; // Optional data, like initial SQL query
}

export default function WorkspaceLayout({ index }: { index: number }) {
  const { unlockAchievement } = useGamification();
  const [connId, setConnId] = useState<string | null>(null);
  const [connectionData, setConnectionData] = useState<any>(null);

  // Modals & Navigation
  const [isConnecting, setIsConnecting] = useState(true);

  // Database Modal
  const [databases, setDatabases] = useState<string[]>([]);
  const [showDbModal, setShowDbModal] = useState(false);
  const [showCreateTableModal, setShowCreateTableModal] = useState(false);
  const [showCreateDbModal, setShowCreateDbModal] = useState(false);
  const [showExportDbModal, setShowExportDbModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);

  // Tables Sidebar
  const [tables, setTables] = useState<{ name: string, table_type: string }[]>([]);

  // Data Grid / Tabs
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [selectedRowData, setSelectedRowData] = useState<{ row: any, schema: any[], onEdit: (col: string, val: string) => void } | null>(null);

  // UI Layout State
  const [showLeftSidebar, setShowLeftSidebar] = useState(() => {
    const saved = localStorage.getItem("kythia:showLeftSidebar");
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showRightSidebar, setShowRightSidebar] = useState(() => {
    try { return JSON.parse(localStorage.getItem("kythia:showRightSidebar") || "true"); } catch { return true; }
  });
  
  const [sidebarFilter, setSidebarFilter] = useState("");
  const [showOmnibar, setShowOmnibar] = useState(false);

  useEffect(() => {
    localStorage.setItem("kythia:showLeftSidebar", JSON.stringify(showLeftSidebar));
  }, [showLeftSidebar]);

  useEffect(() => {
    localStorage.setItem("kythia:showRightSidebar", JSON.stringify(showRightSidebar));
  }, [showRightSidebar]);

  // Initialize Connection
  useEffect(() => {
    const init = async () => {
      try {
        setIsConnecting(true);
        const data: any = await invoke("get_connection", { index });
        setConnectionData(data);
        
        const id = await invoke("connect_workspace", { index });
        setConnId(id as string);
        unlockAchievement('first_connection');
        
        if (!data.database) {
          // If no specific database was selected, show the database picker modal
          const dbs: string[] = await invoke("get_databases", { connId: id });
          setDatabases(dbs);
          setShowDbModal(true);
        } else {
          // We have a database, fetch tables
          loadTables(id as string);
        }
      } catch (e: any) {
        toast.error(`Connection failed: ${e}`);
      } finally {
        setIsConnecting(false);
      }
    };
    init();
  }, [index]);

  const loadTables = async (id: string) => {
    try {
      const t: any[] = await invoke("get_tables", { connId: id });
      setTables(t);
    } catch (e: any) {
      toast.error(`Failed to load tables: ${e}`);
    }
  };

  const openDbModal = async () => {
    if (databases.length === 0 && connId) {
      try {
        const dbs: string[] = await invoke("get_databases", { connId });
        setDatabases(dbs);
      } catch (err) { }
    }
    setShowDbModal(true);
  };

  const importSQL = async () => {
    // Stub
  };

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'p' || e.key === 'o')) {
        e.preventDefault();
        setShowOmnibar(true);
      } else if (e.key === 'Escape') {
        setShowDbModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDbModal, databases, connId]);

  const handleSelectDb = async (db: string) => {
    if (tabs.some(t => t.isDirty)) {
      if (!confirm("You have unsaved changes in one or more tabs. Are you sure you want to change the database?")) return;
    }
    if (!connId || !connectionData) return;
    try {
      // Create a temporary payload with the selected database
      const newPayload = { ...connectionData, database: db };
      await invoke("edit_connection", { index, payload: newPayload });
      setConnectionData(newPayload);

      // Reconnect with new payload
      const id: string = await invoke("connect_workspace", { index });
      setConnId(id);

      setShowDbModal(false);
      loadTables(id);
    } catch (e) {
      toast.error(`Failed to select database: ${e}`);
    }
  };

  const handleSelectTable = (table: string, isDoubleClick: boolean = false) => {
    if (!connId) return;

    // Check if tab already exists
    const existingTabIndex = tabs.findIndex(t => t.type === 'table' && t.title === table);

    if (existingTabIndex >= 0) {
      // Tab exists, switch to it
      setActiveTabId(tabs[existingTabIndex].id);

      // If double clicked, make it permanent
      if (isDoubleClick && tabs[existingTabIndex].isPreview) {
        setTabs(prev => prev.map(t => t.id === tabs[existingTabIndex].id ? { ...t, isPreview: false } : t));
      }
    } else {
      // Tab doesn't exist. Check for an existing preview tab.
      const previewTabIndex = tabs.findIndex(t => t.isPreview);
      const newTab: WorkspaceTab = { id: `table:${table}`, type: 'table', title: table, isDirty: false, isPreview: !isDoubleClick };

      if (previewTabIndex >= 0 && !isDoubleClick) {
        // Replace preview tab
        setTabs(prev => {
          const newTabs = [...prev];
          newTabs[previewTabIndex] = newTab;
          return newTabs;
        });
      } else {
        // Add new tab
        setTabs(prev => [...prev, newTab]);
      }
      setActiveTabId(newTab.id);
      unlockAchievement('table_explorer');
    }

    setSelectedRowData(null);
  };

  const closeTab = (tabId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const tabToClose = tabs.find(t => t.id === tabId);
    if (tabToClose?.isDirty) {
      if (!confirm("This tab has unsaved changes. Are you sure you want to close it?")) {
        return;
      }
    }

    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        // If we closed the active tab, switch to the last tab (if any)
        if (newTabs.length > 0) {
          setActiveTabId(newTabs[newTabs.length - 1].id);
        } else {
          setActiveTabId(null);
        }
      }
      return newTabs;
    });
  };

  const handleDirtyChange = (tabId: string, isDirty: boolean) => {
    setTabs(prev => prev.map(t => {
      if (t.id === tabId) {
        // If it becomes dirty, it automatically stops being a preview tab
        if (isDirty && t.isPreview) {
          return { ...t, isDirty, isPreview: false };
        }
        return { ...t, isDirty };
      }
      return t;
    }));
  };

  if (isConnecting) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-green-500" />
          <p className="text-muted-foreground">Connecting to database...</p>
        </div>
      </div>
    );
  }

  // --- Render Main Workspace ---
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden font-sans relative">

        {/* Database Modal Overlay */}
        <SwitchDatabaseModal
          isOpen={showDbModal}
          onClose={() => setShowDbModal(false)}
          databases={databases}
          onSelectDatabase={handleSelectDb}
        />

        <WorkspaceOmnibar
          isOpen={showOmnibar}
          onClose={() => setShowOmnibar(false)}
          tables={tables}
          databases={databases}
          connectionData={connectionData}
          onSelectTable={(table) => handleSelectTable(table)}
          onSelectDatabase={handleSelectDb}
          onRunQuery={(query) => {
            const newTabId = `query:${Date.now()}`;
            setTabs(prev => [...prev, { id: newTabId, type: 'query', title: 'Query', isDirty: false, isPreview: false, data: query }]);
            setActiveTabId(newTabId);
          }}
          onAction={(action) => {
            if (action === 'new_query') {
              const newTabId = `query:${Date.now()}`;
              setTabs(prev => [...prev, { id: newTabId, type: 'query', title: 'Query', isDirty: false, isPreview: false }]);
              setActiveTabId(newTabId);
            } else if (action === 'create_table') {
              setShowCreateTableModal(true);
            } else if (action === 'create_db') {
              setShowCreateDbModal(true);
            } else if (action === 'export_db') {
              setShowExportDbModal(true);
            } else if (action === 'manage_users') {
              setShowUserModal(true);
            } else if (action === 'disconnect') {
              getCurrentWindow().close();
            }
          }}
        />

        {/* Top Header */}
        <div className="h-[46px] flex items-center justify-between px-3 bg-card border-b border-border app-region-drag relative select-none text-muted-foreground">

          {/* Left Side: Window / Action Controls */}
          <div className="flex items-center gap-2 app-region-no-drag">
            <div className="flex items-center gap-0.5 border border-zinc-700/50 rounded-full px-1.5 py-1 bg-zinc-800/20">

              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setShowLeftSidebar(!showLeftSidebar)} className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
                    <Sidebar className="w-[15px] h-[15px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Toggle Left Sidebar
                </TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
                    <MoreVertical className="w-[15px] h-[15px]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 bg-popover border-border text-popover-foreground shadow-xl p-1">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-default focus:bg-primary focus:text-primary-foreground">
                      File
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-48 bg-popover border-border text-popover-foreground shadow-xl p-1">
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="cursor-default focus:bg-primary focus:text-primary-foreground">
                          New
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48 bg-popover border-border text-popover-foreground shadow-xl p-1">
                          <DropdownMenuItem className="cursor-pointer focus:bg-primary focus:text-primary-foreground" onClick={() => setShowCreateDbModal(true)}>
                            Database
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer focus:bg-primary focus:text-primary-foreground" onClick={() => setShowCreateTableModal(true)}>
                            Table
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="cursor-default focus:bg-primary focus:text-primary-foreground">
                          Import
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48 bg-popover border-border text-popover-foreground shadow-xl p-1">
                          <DropdownMenuItem className="cursor-pointer focus:bg-primary focus:text-primary-foreground" onClick={importSQL}>
                            From SQL
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuItem className="cursor-pointer focus:bg-primary focus:text-primary-foreground" onClick={() => setShowExportDbModal(true)}>
                        Export Database
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-default focus:bg-primary focus:text-primary-foreground">
                      Tools
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-48 bg-popover border-border text-popover-foreground shadow-xl p-1">
                      <DropdownMenuItem
                        className="cursor-pointer focus:bg-primary focus:text-primary-foreground"
                        onClick={() => setShowUserModal(true)}
                      >
                        User Management
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-default focus:bg-primary focus:text-primary-foreground">
                      Connection
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-48 bg-popover border-border text-popover-foreground shadow-xl p-1">
                      <DropdownMenuItem
                        className="cursor-pointer focus:bg-primary focus:text-primary-foreground flex justify-between"
                        onClick={openDbModal}
                      >
                        <span>Open a database...</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border" />
                      <DropdownMenuItem
                        className="cursor-pointer focus:bg-primary focus:text-primary-foreground flex justify-between"
                        onClick={() => getCurrentWindow().close()}
                      >
                        <span>Disconnect</span>
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-0.5 border border-zinc-700/50 rounded-full px-1.5 py-1 bg-zinc-800/20">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      const existingQueryTab = tabs.find(t => t.type === 'query');
                      if (existingQueryTab) {
                        setActiveTabId(existingQueryTab.id);
                      } else {
                        const newTabId = `query:${Date.now()}`;
                        setTabs(prev => [...prev, { id: newTabId, type: 'query', title: 'Query', isDirty: false, isPreview: false }]);
                        setActiveTabId(newTabId);
                      }
                    }}
                    className="h-7 px-3 rounded-full hover:bg-white/10 flex items-center gap-2 transition-colors"
                  >
                    <Database className="w-[15px] h-[15px]" />
                    <span className="text-[11px] font-bold tracking-wider">SQL</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  New SQL Query
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Center: The Green Pill */}
          <div
            onClick={openDbModal}
            className={`flex-1 max-w-[700px] mx-4 py-1.5 px-5 rounded-full text-[11px] font-medium transition-all text-white text-center cursor-pointer flex items-center justify-center gap-2.5 app-region-no-drag border border-white/20 shadow-sm ${connectionData?.color || "bg-primary"} hover:brightness-110`}
          >
            <span>{connectionData?.database || "Select DB"}</span>
          </div>

          {/* Right Side: Tools & Layout */}
          <div className="flex items-center gap-2 app-region-no-drag">

            <div className="flex items-center gap-0.5 border border-zinc-700/50 rounded-full px-1.5 py-1 bg-zinc-800/20">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setShowOmnibar(true)} className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
                    <Command className="w-[15px] h-[15px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Command Palette (⌘K)
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => { if (connId) loadTables(connId); }} className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
                    <RefreshCw className="w-[15px] h-[15px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Refresh Data
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setShowRightSidebar(!showRightSidebar)} className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
                    <PanelRight className="w-[15px] h-[15px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Toggle Right Sidebar
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* Left Sidebar - Navigation */}
          <div
            className={`flex flex-col bg-card/50 border-border shadow-[2px_0_8px_rgba(0,0,0,0.2)] z-10 overflow-hidden transition-[width,opacity,border-color] duration-300 ease-in-out ${showLeftSidebar ? "w-[260px] opacity-100 border-r" : "w-0 opacity-0 border-r-transparent"
              }`}
          >
            <div className={`w-[260px] flex flex-col h-full flex-shrink-0 transition-transform duration-300 ease-in-out ${showLeftSidebar ? "translate-x-0" : "-translate-x-4"}`}>
              <div className="p-2 border-b border-zinc-800 flex flex-col gap-2">
                <InputGroup className="w-full">
                  <InputGroupInput
                    placeholder="Search for item..."
                    className="bg-[#333333] border-transparent focus:border-[#007fd4] text-xs h-7 text-zinc-200 placeholder:text-zinc-500"
                    value={sidebarFilter}
                    onChange={(e) => setSidebarFilter(e.target.value)}
                  />
                  <InputGroupAddon>
                    <Search className="w-3 h-3 text-zinc-400" />
                  </InputGroupAddon>
                </InputGroup>
              </div>

              <div className="flex flex-col h-full bg-zinc-900/50">
                <div className="flex-1 overflow-y-auto custom-scrollbar pb-24">
                  <div className="flex items-center justify-between px-2 py-1.5 mt-2 group/header">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-zinc-200">
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold tracking-wider uppercase">Tables</span>
                    </div>
                    <button onClick={() => setShowCreateTableModal(true)} title="Create Table" className="p-0.5 rounded hover:bg-zinc-700/50 hover:text-zinc-200 opacity-0 group-hover/header:opacity-100 transition-opacity">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <ContextMenu>
                    <ContextMenuTrigger>
                      <div className="flex flex-col mt-0.5 gap-0.5 px-1">
                        {tables.filter(t => t.table_type === "BASE TABLE" && t.name.toLowerCase().includes(sidebarFilter.toLowerCase())).map(t => {
                          const isActive = activeTabId === `table:${t.name}`;
                          const isDirty = tabs.some(tab => tab.type === 'table' && tab.title === t.name && tab.isDirty);
                          return (
                            <button
                              key={t.name}
                              onClick={() => handleSelectTable(t.name)}
                              onDoubleClick={() => handleSelectTable(t.name, true)}
                              className={`group flex items-center gap-2 px-2 py-1.5 text-[12px] rounded-md text-left transition-all ${isActive
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                            >
                              <TableIcon className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"}`} />
                              <span className="truncate font-medium flex-1">{t.name}</span>
                              {isDirty && (
                                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0 mr-1" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border-border text-popover-foreground shadow-xl p-1">
                      <ContextMenuSub>
                        <ContextMenuSubTrigger className="cursor-default focus:bg-primary focus:text-primary-foreground">
                          Import
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-48 bg-popover border-border text-popover-foreground shadow-xl p-1">
                          <ContextMenuItem className="cursor-pointer focus:bg-primary focus:text-primary-foreground" onClick={importSQL}>
                            From SQL
                          </ContextMenuItem>
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                      <ContextMenuItem
                        className="cursor-pointer focus:bg-primary focus:text-primary-foreground"
                        onClick={() => setShowExportDbModal(true)}
                      >
                        Export Database
                      </ContextMenuItem>
                      <ContextMenuSub>
                        <ContextMenuSubTrigger className="cursor-default focus:bg-primary focus:text-primary-foreground">
                          New
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-56 bg-popover border-border text-popover-foreground shadow-xl p-1">
                          <ContextMenuItem className="cursor-pointer focus:bg-primary focus:text-primary-foreground" onClick={() => setShowCreateTableModal(true)}>
                            Table
                          </ContextMenuItem>
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                    </ContextMenuContent>
                  </ContextMenu>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-background">

            {/* Tabs */}
            <div className="flex h-9 bg-muted/50 border-b border-border overflow-x-auto custom-scrollbar-hide">
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  onClick={() => {
                    setActiveTabId(tab.id);
                    setSelectedRowData(null);
                  }}
                  onDoubleClick={() => handleSelectTable(tab.title, true)}
                  className={`px-4 flex items-center gap-2 border-r border-border text-[13px] min-w-[120px] max-w-[200px] cursor-pointer group transition-colors ${activeTabId === tab.id ? "bg-background text-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted"
                    }`}
                >
                  <span className={`truncate flex-1 ${tab.isPreview ? 'italic text-muted-foreground' : 'font-medium'}`}>
                    {tab.title}
                  </span>
                  {tab.isDirty && (
                    <div className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                  )}
                  <button
                    onClick={(e) => closeTab(tab.id, e)}
                    className="opacity-0 group-hover:opacity-100 hover:bg-zinc-700 rounded-xl p-0.5 transition-opacity flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Tab Content / Grid */}
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 min-w-0 bg-background relative overflow-hidden flex flex-col">
                {tabs.length === 0 || !connId ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                    <Database className="w-16 h-16 mb-4 opacity-20" />
                    <p>Select a table from the sidebar to begin</p>
                  </div>
                ) : (
                  tabs.map(tab => (
                    <div
                      key={tab.id}
                      className={`flex-1 overflow-hidden h-full ${activeTabId === tab.id ? "flex" : "hidden"}`}
                    >
                      {tab.type === 'table' ? (
                        <DataGrid
                          connId={connId}
                          tableName={tab.title}
                          onDirtyChange={(isDirty) => handleDirtyChange(tab.id, isDirty)}
                          onRowSelect={(row, schema, onEdit) => {
                            if (activeTabId === tab.id) {
                              setSelectedRowData({ row, schema, onEdit });
                            }
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[#0f0f11]">
                          <SqlEditor connId={connId!} initialQuery={tab.data} />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Right Sidebar - Details (Collapsed/Placeholder) */}
              <div
                className={`flex flex-col bg-card/50 border-border shadow-[-2px_0_8px_rgba(0,0,0,0.2)] z-10 overflow-hidden transition-[width,opacity,border-color] duration-300 ease-in-out ${showRightSidebar ? "w-[280px] opacity-100 border-l" : "w-0 opacity-0 border-l-transparent"
                  }`}
              >
                <div className={`w-[280px] flex flex-col h-full flex-shrink-0 transition-transform duration-300 ease-in-out ${showRightSidebar ? "translate-x-0" : "translate-x-4"}`}>
                  <Tabs defaultValue="details" className="w-full flex flex-col h-full">
                    <div className="flex items-center justify-center p-2 border-b border-border bg-card/50 shrink-0">
                      <TabsList className="w-full grid w-full grid-cols-2 bg-black/20 h-8 p-1">
                        <TabsTrigger value="details" className="text-[11px]">Details</TabsTrigger>
                        <TabsTrigger value="assistant" className="text-[11px]">Assistant</TabsTrigger>
                      </TabsList>
                    </div>
                    <TabsContent value="details" className="flex-1 overflow-y-auto custom-scrollbar p-0 m-0 border-none outline-none">
                      {selectedRowData ? (
                        <div className="flex flex-col text-xs">
                          {selectedRowData.schema.map(col => {
                            const val = selectedRowData.row[col.field];
                            const isNull = val === null || val === undefined;
                            return (
                              <div key={col.field} className="flex flex-col border-b border-zinc-800/50 p-2 hover:bg-zinc-800/30 transition-colors group focus-within:bg-zinc-800/50">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-zinc-300 truncate pr-2 group-hover:text-blue-400 transition-colors">{col.field}</span>
                                  <span className="text-[10px] text-zinc-500 font-mono shrink-0">{col.type_name}</span>
                                </div>
                                {col.comment && (
                                  <div className="text-[10px] text-zinc-500 italic mb-1.5 truncate">
                                    {col.comment}
                                  </div>
                                )}
                                <div className="text-zinc-400 font-mono w-full">
                                  <input
                                    type="text"
                                    className="w-full bg-transparent border-none outline-none text-zinc-200 font-mono placeholder:text-zinc-600 placeholder:italic focus:ring-0 focus:text-white"
                                    defaultValue={isNull ? "" : String(val)}
                                    placeholder="NULL"
                                    onBlur={(e) => {
                                      const newVal = e.target.value;
                                      if (newVal !== String(val) && !(isNull && newVal === "")) {
                                        selectedRowData.onEdit(col.field, newVal);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.currentTarget.blur();
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs gap-3">
                          <LayoutGrid className="w-8 h-8 opacity-20" />
                          No row selected
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="assistant" className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-xs p-4 m-0 border-none outline-none">
                      <p className="text-center">AI Assistant functionality coming soon.</p>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showCreateTableModal && connId && (
        <CreateTableModal
          connId={connId}
          onClose={() => setShowCreateTableModal(false)}
          onSuccess={() => {
            setShowCreateTableModal(false);
            loadTables(connId);
          }}
        />
      )}

      {showUserModal && (
        <UserManagementModal
          connId={connId || ""}
          onClose={() => setShowUserModal(false)}
        />
      )}

      {showExportDbModal && (
        <ExportDatabaseModal
          connId={connId!}
          dbName={connectionData?.database || "database"}
          tables={tables}
          onClose={() => setShowExportDbModal(false)}
        />
      )}

      {showCreateDbModal && (
        <CreateDatabaseModal
          connId={connId!}
          onClose={() => setShowCreateDbModal(false)}
          onSuccess={(dbName) => {
            setShowCreateDbModal(false);
            invoke("get_databases", { connId }).then((res: any) => setDatabases(res)).catch(e => console.error(e));
            handleSelectDb(dbName);
          }}
        />
      )}
    </TooltipProvider>
  );
}
