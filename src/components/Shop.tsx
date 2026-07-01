import { useGamification } from '../hooks/useGamification';
import { SHOP_ITEMS } from '../lib/shop';
import { Button } from './ui/button';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { Coins, Palette, Music, Shield } from 'lucide-react';

export function Shop() {
  const { data, loading, refresh } = useGamification();

  if (loading) return null;

  const handlePurchase = async (id: string, cost: number) => {
    if (data.coins < cost) {
      toast.error('Not enough coins!');
      return;
    }
    try {
      await invoke('purchase_item', { id, cost });
      toast.success('Purchase successful!');
      window.dispatchEvent(new Event('gamification-update'));
      refresh();
    } catch (e: any) {
      toast.error(`Purchase failed: ${e}`);
    }
  };

  const handleEquip = async (id: string, type: 'theme' | 'sound' | 'badge') => {
    try {
      const command = type === 'theme' ? 'equip_theme' : type === 'sound' ? 'equip_sound' : 'equip_badge';
      await invoke(command, { id });
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} equipped!`);
      window.dispatchEvent(new Event('gamification-update'));
      refresh();
    } catch (e: any) {
      toast.error(`Equip failed: ${e}`);
    }
  };

  const handleUnequip = async (type: 'theme' | 'sound' | 'badge') => {
    try {
      const command = type === 'theme' ? 'equip_theme' : type === 'sound' ? 'equip_sound' : 'equip_badge';
      const id = type === 'theme' ? 'default' : 'none';
      await invoke(command, { id });
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} unequipped!`);
      window.dispatchEvent(new Event('gamification-update'));
      refresh();
    } catch (e: any) {
      toast.error(`Unequip failed: ${e}`);
    }
  };

  return (
    <div className="w-full">
      <div className="max-w-5xl mx-auto w-full">
        <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-border/50">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Coin Store</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Spend your hard-earned Kythia Coins on exclusive themes and cosmetics.
          </p>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Your Balance</div>
          <div className="text-3xl font-black text-amber-500 flex items-center gap-2">
            {data.coins} <Coins className="w-6 h-6" />
          </div>
        </div>
      </div>

      {['theme', 'sound', 'badge'].map((category) => {
        const categoryItems = SHOP_ITEMS.filter(i => i.type === category);
        if (categoryItems.length === 0) return null;
        
        const categoryTitles: Record<string, string> = {
          theme: 'UI Themes',
          sound: 'Sound Packs',
          badge: 'Developer Badges'
        };
        const CategoryIcon = category === 'theme' ? Palette : category === 'sound' ? Music : Shield;

        return (
          <div key={category} className="mb-12 last:mb-0">
            <h3 className="text-xl font-bold tracking-tight mb-6 flex items-center gap-2">
              <CategoryIcon className="w-6 h-6 text-primary" />
              {categoryTitles[category]}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categoryItems.map(item => {
                const isOwned = data.purchased_items.includes(item.id);
                const isEquipped = item.type === 'theme' 
                  ? data.active_theme === item.id 
                  : item.type === 'sound' 
                    ? data.active_sound_pack === item.id 
                    : data.active_badge === item.id;
                const Icon = item.icon;
                const canAfford = data.coins >= item.cost;

                return (
                  <div 
                    key={item.id} 
                    className={`relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 ${
                      isEquipped 
                        ? 'bg-card/80 border-primary/50 shadow-lg shadow-primary/10' 
                        : 'bg-background/50 border-border/50 hover:border-border'
                    }`}
                  >
                    <div className="flex items-start gap-4 mb-4 p-6 pb-0">
                      <div className={`p-3 rounded-xl ${isEquipped ? 'bg-primary/20' : 'bg-secondary'}`}>
                        <Icon className={`w-8 h-8 ${isEquipped ? 'text-primary' : item.color}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-foreground">{item.name}</h3>
                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                          {item.type}
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-6 flex-1 px-6">
                      {item.description}
                    </p>

                    <div className="mt-auto px-6 pb-6">
                      {isEquipped ? (
                        <Button 
                          onClick={() => handleUnequip(item.type as any)}
                          variant="outline" 
                          className="w-full bg-primary/10 text-primary border-primary/20 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
                        >
                          Unequip
                        </Button>
                      ) : isOwned ? (
                        <Button 
                          onClick={() => handleEquip(item.id, item.type as any)}
                          variant="outline" 
                          className="w-full hover:bg-primary hover:text-primary-foreground border-primary"
                        >
                          Equip {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => handlePurchase(item.id, item.cost)}
                          disabled={!canAfford}
                          className={`w-full ${canAfford ? 'bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold' : 'bg-secondary text-muted-foreground'}`}
                        >
                          Buy for {item.cost} <Coins className="w-4 h-4 ml-1.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
        </div>
      </div>
    </div>
  );
}
