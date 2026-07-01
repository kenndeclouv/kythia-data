
import { Key } from "lucide-react";

interface ColumnSchema {
  field: string;
  type_name: string;
  null: string;
  key: string;
  default_val: string | null;
  extra: string;
}

interface SchemaGridProps {
  schema: ColumnSchema[];
}

export default function SchemaGrid({ schema }: SchemaGridProps) {
  return (
    <div className="flex-1 overflow-auto custom-scrollbar">
      <table className="w-full text-left text-[13px] border-collapse">
        <thead className="sticky top-0 bg-[#252526] z-10 shadow-sm">
          <tr>
            <th className="w-10 border-r border-b border-zinc-800 bg-[#252526]"></th>
            <th className="px-3 py-1.5 font-medium border-r border-b border-zinc-800 text-zinc-300">Name</th>
            <th className="px-3 py-1.5 font-medium border-r border-b border-zinc-800 text-zinc-300">Type</th>
            <th className="px-3 py-1.5 font-medium border-r border-b border-zinc-800 text-zinc-300">Nullable</th>
            <th className="px-3 py-1.5 font-medium border-r border-b border-zinc-800 text-zinc-300">Default</th>
            <th className="px-3 py-1.5 font-medium border-r border-b border-zinc-800 text-zinc-300">Extra</th>
          </tr>
        </thead>
        <tbody>
          {schema.map((col, i) => {
            const isPk = col.key === "PRI";
            return (
              <tr key={col.field} className="hover:bg-[#2a2d2e] group border-b border-zinc-800/50">
                <td className="px-2 py-1 text-center text-zinc-500 text-[11px] border-r border-zinc-800 bg-[#252526]/50 select-none flex items-center justify-center h-full">
                  {isPk ? <Key className="w-3 h-3 text-yellow-500" /> : i + 1}
                </td>
                <td className="px-3 py-1.5 border-r border-zinc-800/50 text-zinc-200 font-medium">
                  {col.field}
                </td>
                <td className="px-3 py-1.5 border-r border-zinc-800/50 text-blue-400 font-mono text-xs">
                  {col.type_name}
                </td>
                <td className="px-3 py-1.5 border-r border-zinc-800/50 text-zinc-300">
                  {col.null === "YES" ? "Yes" : "No"}
                </td>
                <td className="px-3 py-1.5 border-r border-zinc-800/50 text-zinc-400 italic">
                  {col.default_val === null ? "NULL" : col.default_val}
                </td>
                <td className="px-3 py-1.5 border-r border-zinc-800/50 text-zinc-400 text-xs">
                  {col.extra}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
