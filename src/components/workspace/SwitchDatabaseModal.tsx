import { useState, useEffect, useRef } from "react";
import { Search, ArrowRight, CornerDownLeft, Database } from "lucide-react";

interface SwitchDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  databases: string[];
  onSelectDatabase: (db: string) => void;
}

export default function SwitchDatabaseModal({
  isOpen, onClose, databases, onSelectDatabase
}: SwitchDatabaseModalProps) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const filteredDbs = databases.filter(d => d.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    if (listRef.current && isOpen) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex, isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      setSelectedIndex(prev => (prev < filteredDbs.length - 1 ? prev + 1 : prev));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
      e.preventDefault();
    } else if (e.key === "Enter") {
      if (filteredDbs[selectedIndex]) {
        onSelectDatabase(filteredDbs[selectedIndex]);
        onClose();
      }
      e.preventDefault();
    }
  };

  return (
    <div 
      className="absolute inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm p-4 font-sans"
      onClick={onClose}
    >
      <div 
        className="w-[500px] bg-[#1e1e20] rounded-xl shadow-2xl shadow-black/50 border border-zinc-700/60 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-4 border-b border-zinc-700/60 bg-[#18181b]">
          <Search className="w-5 h-5 text-zinc-400 mr-3 shrink-0" />
          <input 
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-0 text-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-0 p-0 m-0 w-full"
            placeholder="Search databases..."
          />
          <div className="flex items-center gap-2 ml-4 shrink-0">
            <span className="text-[10px] font-mono bg-zinc-800 px-1.5 py-1 rounded text-zinc-400 border border-zinc-700">ESC</span>
            <span className="text-[10px] font-mono bg-zinc-800 px-1.5 py-1 rounded text-zinc-400 border border-zinc-700 flex items-center gap-1">
              <CornerDownLeft className="w-3 h-3" />
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[350px] p-2 space-y-1 bg-[#1e1e20] custom-scrollbar" ref={listRef}>
          {filteredDbs.length === 0 ? (
            <div className="py-10 text-center">
              <Search className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">No databases found</p>
            </div>
          ) : (
            <>
              <div className="px-3 py-2 mt-1 text-xs font-semibold text-zinc-400 ">
                Databases
              </div>
              {filteredDbs.map((db, index) => {
                const isSelected = index === selectedIndex;
                
                return (
                  <button
                    key={db}
                    data-index={index}
                    onClick={() => {
                      onSelectDatabase(db);
                      onClose();
                    }}
                    onMouseMove={() => setSelectedIndex(index)}
                    className={`w-full text-left px-3 py-2.5 flex items-center justify-between rounded-lg outline-none transition-colors group ${
                      isSelected 
                        ? 'bg-primary text-primary-foreground shadow-md' 
                        : 'hover:bg-zinc-800/60 focus:bg-zinc-800/60 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-md ${isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-zinc-800 text-blue-400'}`}>
                        <Database className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium">{db}</span>
                    </div>
                    {isSelected && (
                      <span className="text-xs text-primary-foreground/80 flex items-center gap-1">
                        Switch <ArrowRight className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
