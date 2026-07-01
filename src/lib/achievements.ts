import React from 'react';
import { Database, Terminal, Table, Code, FileDown, Shield, Moon, Coffee, Clock, Skull, Activity, ShieldAlert, Key } from 'lucide-react';

export interface AchievementCatalog {
  id: string;
  title: string;
  description: string;
  rewardXp: number;
  rewardCoins: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  progressTarget?: number;
  progressType?: 'minutes' | 'count';
}

export const ACHIEVEMENTS: AchievementCatalog[] = [
  // Starter Achievements
  { id: 'first_connection', title: 'First Contact', description: 'Make your very first database connection.', rewardXp: 50, rewardCoins: 10, icon: Database, color: 'text-blue-500' },
  { id: 'query_beginner', title: 'Hello SQL', description: 'Execute your first custom SQL query.', rewardXp: 120, rewardCoins: 25, icon: Terminal, color: 'text-rose-500' },
  { id: 'table_explorer', title: 'Data Explorer', description: 'Open a table to view its contents for the first time.', rewardXp: 80, rewardCoins: 10, icon: Table, color: 'text-emerald-500' },
  
  // Power User Achievements
  { id: 'query_master', title: 'Query Master', description: 'Execute a successful Data Manipulation (INSERT/UPDATE/DELETE) query.', rewardXp: 200, rewardCoins: 40, icon: Code, color: 'text-cyan-500' },
  { id: 'data_architect', title: 'The Architect', description: 'Create a new database from scratch.', rewardXp: 100, rewardCoins: 20, icon: Activity, color: 'text-fuchsia-500' },
  { id: 'table_wizard', title: 'Table Wizard', description: 'Create a new table using the UI.', rewardXp: 150, rewardCoins: 30, icon: Table, color: 'text-violet-500' },
  { id: 'data_exporter', title: 'Data Exporter', description: 'Export a database or table to a SQL dump.', rewardXp: 150, rewardCoins: 30, icon: FileDown, color: 'text-orange-400' },
  { id: 'security_guard', title: 'Security Guard', description: 'Change a database user\'s privileges or password.', rewardXp: 200, rewardCoins: 50, icon: Shield, color: 'text-yellow-500' },

  // Time & Commitment (Requires Stats Tracking)
  { id: 'night_owl', title: 'Night Owl', description: 'Query databases past midnight. The data never sleeps, neither do you.', rewardXp: 250, rewardCoins: 50, icon: Moon, color: 'text-indigo-400' },
  { id: 'early_bird', title: 'Early Bird', description: 'Connect before 6 AM. The early bird gets the data.', rewardXp: 250, rewardCoins: 50, icon: Coffee, color: 'text-amber-600' },
  { id: 'marathon_24h', title: 'Iron DBA', description: 'Accumulate 24 hours of total active session time.', rewardXp: 500, rewardCoins: 100, icon: Clock, color: 'text-green-500', progressTarget: 1440, progressType: 'minutes' },
  
  // Hardcore / Chaos
  { id: 'bobby_tables', title: 'Bobby Tables', description: 'Execute a DROP TABLE command. We hope you know what you\'re doing.', rewardXp: 300, rewardCoins: 60, icon: Skull, color: 'text-red-500' },
  { id: 'root_access', title: 'I Am Root', description: 'Connect using the root user account.', rewardXp: 150, rewardCoins: 50, icon: Key, color: 'text-yellow-600' },
  { id: 'access_denied', title: 'Access Denied', description: 'Encounter a privilege error (e.g., trying to view users without grant option).', rewardXp: 100, rewardCoins: 20, icon: ShieldAlert, color: 'text-rose-600' }
];
