import { useState, useEffect, createElement } from 'react';
import { toast } from 'sonner';
import { Trophy } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { GamificationData } from '../types';
import { ACHIEVEMENTS } from '../lib/achievements';
import { SHOP_ITEMS } from '../lib/shop';
let serverListenerRegistered = false;

export function useGamification() {
  const [data, setData] = useState<GamificationData>({ 
    level: 1, 
    current_xp: 0, 
    coins: 0, 
    unlocked_achievements: [], 
    total_uptime_minutes: 0, 
    purchased_items: [], 
    active_theme: 'default', 
    active_sound_pack: 'none', 
    username: 'Developer',
    nickname: 'Newbie',
    active_badge: 'none',
    active_title: 'none',
    avatar_data: null
  });
  const [loading, setLoading] = useState(true);

  const fetchGamificationData = async () => {
    try {
      const res = await invoke<GamificationData>('get_gamification_data');
      setData(res);
    } catch (error) {
      console.error('Failed to fetch gamification data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGamificationData();
    
    const interval = setInterval(fetchGamificationData, 10000); // refresh every 10s
    
    // Listen for instant updates
    const handleUpdate = () => {
      fetchGamificationData();
    };
    window.addEventListener('gamification-update', handleUpdate);

    // Listen for backend achievements only once
    if (!serverListenerRegistered) {
      serverListenerRegistered = true;
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<string>('unlock-achievement-server', (event) => {
          const id = event.payload;
          const achievement = ACHIEVEMENTS.find(a => a.id === id);
          if (achievement) {
            toast.success(`Achievement Unlocked: ${achievement.title}!`, {
              description: `+${achievement.rewardXp} XP  •  +${achievement.rewardCoins} Coins`,
              icon: createElement(Trophy)
            });
          }
          fetchGamificationData();
        });
      });
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('gamification-update', handleUpdate);
    };
  }, []);

  const addXp = async (amount: number) => {
    try {
      const res = await invoke<GamificationData>('add_xp', { amount });
      setData(res);
    } catch (error) {
      console.error('Failed to add XP:', error);
    }
  };

  const addCoins = async (amount: number) => {
    try {
      const res = await invoke<GamificationData>('add_coins', { amount });
      setData(res);
    } catch (error) {
      console.error('Failed to add Coins:', error);
    }
  };

  const unlockAchievement = async (id: string) => {
    try {
      const achievement = ACHIEVEMENTS.find(a => a.id === id);
      const rewardXp = achievement ? achievement.rewardXp : 0;
      const rewardCoins = achievement ? achievement.rewardCoins : 0;

      const res = await invoke<{ success: boolean, message: string, data: GamificationData }>('unlock_achievement', { 
        id, 
        rewardXp, 
        rewardCoins 
      });
      if (res.success) {
        setData(res.data);
        if (achievement) {
          toast.success(`Achievement Unlocked: ${achievement.title}!`, {
            description: `+${rewardXp} XP  •  +${rewardCoins} Coins`,
            icon: createElement(Trophy)
          });
        }
      }
      return res;
    } catch (error) {
      console.error('Failed to unlock achievement:', error);
      return { success: false, message: 'Error', data };
    }
  };

  const playSoundEffect = () => {
    if (data.active_sound_pack && data.active_sound_pack !== 'none') {
      const item = SHOP_ITEMS.find(i => i.id === data.active_sound_pack);
      if (item && item.audioUrl) {
        new Audio(item.audioUrl).play().catch(e => console.log('Audio playback prevented:', e));
      }
    }
  };

  return {
    data,
    loading,
    addXp,
    addCoins,
    unlockAchievement,
    playSoundEffect,
    refresh: fetchGamificationData
  };
}
