import React, { useState, useEffect, useRef } from "react";
import { Table as TableIcon, Database, Search, ArrowRight, CornerDownLeft, Terminal, PlusSquare, Plus, Download, Users, Power } from "lucide-react";

interface OmnibarProps {
  isOpen: boolean;
  onClose: () => void;
  tables: any[];
  databases: string[];
  connectionData: any;
  onSelectTable: (tableName: string) => void;
  onSelectDatabase: (dbName: string) => void;
  onRunQuery?: (query: string) => void;
  onAction?: (actionId: string) => void;
}

type OmnibarItem = 
  | { id: string; type: 'table'; name: string }
  | { id: string; type: 'database'; name: string }
  | { id: string; type: 'action'; name: string; actionId: string; icon: React.ElementType }
  | { id: string; type: 'query'; name: string; query: string };

const COMMANDS = [
  { id: 'new_query', name: 'New SQL Query', icon: Terminal },
  { id: 'create_table', name: 'Create Table', icon: PlusSquare },
  { id: 'create_db', name: 'Create Database', icon: Plus },
  { id: 'export_db', name: 'Export Database', icon: Download },
  { id: 'manage_users', name: 'Manage Users', icon: Users },
  { id: 'disconnect', name: 'Disconnect', icon: Power },
];

class OmnibarErrorBoundary extends React.Component<{children: React.ReactNode}, {error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="absolute inset-0 z-[9999] bg-red-900 text-white p-10 font-mono flex flex-col items-center justify-center">
          <h1 className="text-3xl font-bold mb-4">Omnibar Crashed</h1>
          <pre className="bg-black/50 p-4 rounded text-left whitespace-pre-wrap w-full max-w-2xl text-sm">
            {this.state.error.toString()}
            {'\n'}
            {this.state.error.stack}
          </pre>
          <button className="mt-6 px-4 py-2 bg-white text-red-900 rounded font-bold" onClick={() => this.setState({ error: null })}>
            Dismiss
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function WorkspaceOmnibarInner({
  isOpen, onClose, tables, databases, onSelectTable, onSelectDatabase, onRunQuery, onAction
}: OmnibarProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (listRef.current && isOpen) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex, isOpen]);

  if (!isOpen) return null;

  const safeTables = Array.isArray(tables) ? tables : [];
  const safeDbs = Array.isArray(databases) ? databases : [];
  const q = (query || "").toLowerCase();
  
  // Is this a SQL query?
  const isQuery = /^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE)\b/i.test(query.trim());

  let items: OmnibarItem[] = [];

  if (isQuery) {
    items = [{ id: 'run_query', type: 'query', name: `Run Query: ${query}`, query }];
  } else {
    const filteredCommands = COMMANDS.filter(c => c.name.toLowerCase().includes(q));
    const filteredTables = safeTables.filter(t => (t?.name || "").toLowerCase().includes(q));
    const filteredDbs = safeDbs.filter(d => (d || "").toLowerCase().includes(q));

    items = [
      ...filteredCommands.map(c => ({ id: `c_${c.id}`, type: 'action' as const, name: c.name, actionId: c.id, icon: c.icon })),
      ...filteredTables.map(t => ({ id: `t_${t?.name || 'unknown'}`, type: 'table' as const, name: t?.name || "Unknown" })),
      ...filteredDbs.map(d => ({ id: `d_${d || 'unknown'}`, type: 'database' as const, name: d || "Unknown" }))
    ];
  }

  const handleSelect = (item: OmnibarItem) => {
    if (item.type === 'table') {
      onSelectTable(item.name);
    } else if (item.type === 'database') {
      onSelectDatabase(item.name);
    } else if (item.type === 'query' && onRunQuery) {
      onRunQuery(item.query);
    } else if (item.type === 'action' && onAction) {
      onAction(item.actionId);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      setSelectedIndex(prev => (prev < items.length - 1 ? prev + 1 : prev));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
      e.preventDefault();
    } else if (e.key === "Enter") {
      if (items[selectedIndex]) {
        handleSelect(items[selectedIndex]);
      }
      e.preventDefault();
    }
  };

  // Helper to render groups
  const renderGroup = (title: string, groupItems: OmnibarItem[], iconColorClass: string, defaultIcon?: any) => {
    if (groupItems.length === 0) return null;
    
    return (
      <>
        <div className="px-3 py-2 mt-2 text-xs font-semibold text-zinc-400">
          {title}
        </div>
        {groupItems.map(item => {
          const itemIndex = items.findIndex(i => i.id === item.id);
          const isSelected = itemIndex === selectedIndex;
          
          let Icon = defaultIcon;
          if (item.type === 'action') Icon = item.icon;
          if (item.type === 'query') Icon = Terminal;

          return (
            <button
              key={item.id}
              data-index={itemIndex}
              onClick={() => handleSelect(item)}
              onMouseMove={() => setSelectedIndex(itemIndex)}
              className={`w-full text-left px-3 py-2.5 flex items-center justify-between rounded-lg outline-none transition-colors group ${
                isSelected 
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'hover:bg-zinc-800/60 focus:bg-zinc-800/60 text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-3 w-full overflow-hidden">
                <div className={`p-1.5 rounded-md shrink-0 ${isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : `bg-zinc-800 ${iconColorClass}`}`}>
                  {Icon && <Icon className="w-4 h-4" />}
                </div>
                <span className="text-sm font-medium truncate">{item.name}</span>
              </div>
              {isSelected && (
                <span className="text-xs text-primary-foreground/80 flex items-center gap-1 shrink-0 ml-2">
                  {item.type === 'action' ? 'Execute' : item.type === 'query' ? 'Run' : 'Open'} <ArrowRight className="w-3 h-3" />
                </span>
              )}
            </button>
          );
        })}
      </>
    );
  };

  const queries = items.filter(i => i.type === 'query');
  const commands = items.filter(i => i.type === 'action');
  const tbls = items.filter(i => i.type === 'table');
  const dbs = items.filter(i => i.type === 'database');

  return (
    <div 
      className="absolute inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm p-4 font-sans"
      onClick={onClose}
    >
      <div 
        className="w-[650px] bg-[#1e1e20] rounded-xl shadow-2xl shadow-black/50 border border-zinc-700/60 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-4 border-b border-zinc-700/60 bg-[#18181b]">
          <Search className="w-5 h-5 text-zinc-400 mr-3 shrink-0" />
          <input 
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-0 text-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-0 p-0 m-0 w-full"
            placeholder={`Search data or type SQL...`}
          />
          <div className="flex items-center gap-2 ml-4 shrink-0">
            <span className="text-[10px] font-mono bg-zinc-800 px-1.5 py-1 rounded text-zinc-400 border border-zinc-700">ESC</span>
            <span className="text-[10px] font-mono bg-zinc-800 px-1.5 py-1 rounded text-zinc-400 border border-zinc-700 flex items-center gap-1">
              <CornerDownLeft className="w-3 h-3" />
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[450px] p-2 space-y-1 bg-[#1e1e20] custom-scrollbar" ref={listRef}>
          {items.length === 0 ? (
            <div className="py-14 text-center">
              <Search className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">No results found for "{query}"</p>
            </div>
          ) : (
            <>
              {renderGroup("SQL Query", queries, "text-green-400")}
              {renderGroup("Commands", commands, "text-purple-400")}
              {renderGroup("Tables", tbls, "text-primary", TableIcon)}
              {renderGroup("Databases", dbs, "text-blue-400", Database)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceOmnibar(props: OmnibarProps) {
  return (
    <OmnibarErrorBoundary>
      <WorkspaceOmnibarInner {...props} />
    </OmnibarErrorBoundary>
  );
}
