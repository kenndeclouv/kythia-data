import React from 'react';
import { useGamification } from '../hooks/useGamification';
import { Coins, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const GamificationBadge: React.FC = () => {
  const { data, loading } = useGamification();
  const navigate = useNavigate();

  if (loading) return null;

  // Next level requires: level * 100 XP
  const xpNeededForNext = data.level * 100;
  const progressPercentage = Math.min((data.current_xp / xpNeededForNext) * 100, 100);

  return (
    <div className="flex items-center gap-4 bg-card/50 backdrop-blur-md px-4 py-2 rounded-lg border border-border/50 shadow-lg transition-all duration-300 ">
      
      {/* Level & XP section */}
      <div className="flex flex-col gap-1 w-32">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs font-bold text-primary">
            <Star size={12} className="fill-primary" />
            <span>LVL {data.level}</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">
            {data.current_xp} / {xpNeededForNext}
          </span>
        </div>
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary to-primary/50 transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Coins section */}
      <div className="flex items-center gap-2 group cursor-pointer" onClick={() => navigate('/shop')}>
        <div className="bg-amber-500/10 p-1.5 rounded-full group-hover:scale-110 transition-transform">
          <Coins size={14} className="text-amber-500" />
        </div>
        <span className="text-sm font-semibold text-amber-500/90">{data.coins}</span>
      </div>
      
    </div>
  );
};
