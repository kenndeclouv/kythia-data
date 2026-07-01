import { useGamification } from '../hooks/useGamification';
import { ACHIEVEMENTS } from '../lib/achievements';
import { Progress } from './ui/progress';

export function Achievements() {
  const { data, loading } = useGamification();

  if (loading) return null;

  return (
    <div className="w-full">
      <div className="max-w-5xl mx-auto w-full">
        <div className="space-y-6 animate-in fade-in duration-500">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Developer Achievements</h2>
        <p className="text-muted-foreground text-sm">
          Unlock achievements by exploring features and building awesome things in Kythia.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ACHIEVEMENTS.map(ach => {
          const isUnlocked = data.unlocked_achievements.includes(ach.id);
          const Icon = ach.icon;

          return (
            <div 
              key={ach.id} 
              className={`flex flex-col relative overflow-hidden p-5 rounded-2xl border transition-all duration-300 ${
                isUnlocked 
                  ? 'bg-card/80 border-primary/30 shadow-lg shadow-primary/10 hover:border-primary/50' 
                  : 'bg-background/50 border-border/50 grayscale hover:grayscale-0'
              }`}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className={`p-2.5 rounded-xl ${isUnlocked ? 'bg-indigo-500/10' : 'bg-secondary'}`}>
                  <Icon className={`w-6 h-6 ${isUnlocked ? ach.color : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold ${isUnlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {ach.title}
                  </h3>
                  <div className="text-[10px] font-semibold text-primary/80 uppercase tracking-wider">
                    {isUnlocked ? 'Unlocked' : 'Locked'}
                  </div>
                </div>
              </div>
              
              <p className={`text-sm mb-4 flex-1 ${isUnlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
                {ach.description}
              </p>

              {ach.progressTarget && !isUnlocked && (
                <div className="mb-4 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <span>Progress</span>
                    <span>{data.total_uptime_minutes} / {ach.progressTarget} {ach.progressType}</span>
                  </div>
                  <Progress value={(data.total_uptime_minutes / ach.progressTarget) * 100} className="h-1.5" />
                </div>
              )}
              {ach.progressTarget && isUnlocked && (
                <div className="mb-4 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-semibold text-primary uppercase tracking-wider">
                    <span>Progress</span>
                    <span>Completed</span>
                  </div>
                  <Progress value={100} className="h-1.5" />
                </div>
              )}

              <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${isUnlocked ? 'text-primary' : 'text-muted-foreground'}`}>
                    +{ach.rewardXp} XP
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-semibold ${isUnlocked ? 'text-amber-500' : 'text-muted-foreground'}`}>
                    +{ach.rewardCoins} Coins
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        </div>
        </div>
      </div>
    </div>
  );
}
