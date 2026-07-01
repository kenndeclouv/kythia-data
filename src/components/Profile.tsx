import { useState, useRef, useEffect } from 'react';
import { useGamification } from '../hooks/useGamification';
import { SHOP_ITEMS } from '../lib/shop';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Camera, Save, Award, Clock, Trophy, Coins } from 'lucide-react';
import { Progress } from './ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "./ui/dialog";
export function Profile() {
  const { data, loading, refresh } = useGamification();
  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data && !loading && !hasInitialized) {
      setUsername(data.username);
      setNickname(data.nickname);
      setAvatar(data.avatar_data || null);
      setHasInitialized(true);
    }
  }, [data, loading, hasInitialized]);

  if (loading || !data) return null;

  const activeBadge = SHOP_ITEMS.find(item => item.type === 'badge' && item.id === data.active_badge);
  const BadgeIcon = activeBadge?.icon;
  const activeTitle = activeBadge ? activeBadge.name : (data.active_title || "Newbie");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check size (max 2MB to keep it safe for local storage)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image is too large. Maximum size is 2MB.');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatar(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (nickname.trim().length === 0) {
      toast.error('Nickname cannot be empty.');
      return;
    }
    if (username.trim().length === 0) {
      toast.error('Username cannot be empty.');
      return;
    }
    
    setIsSaving(true);
    try {
      await invoke('update_profile', { 
        username: username.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''), // safe username
        nickname: nickname.trim(),
        avatarData: avatar
      });
      toast.success('Profile updated successfully!');
      window.dispatchEvent(new Event('gamification-update'));
      refresh();
    } catch (e: any) {
      toast.error(`Failed to update profile: ${e}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await invoke('delete_account');
      toast.success('Account deleted successfully. Progress reset.');
      window.dispatchEvent(new Event('gamification-update'));
      refresh();
    } catch (e: any) {
      toast.error(`Failed to delete account: ${e}`);
    }
  };

  const xpNeeded = data.level * 100;
  const progressPercent = Math.min(100, Math.max(0, (data.current_xp / xpNeeded) * 100));

  return (
    <div className="w-full">
      <div className="max-w-5xl mx-auto w-full">
        <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between pb-6 border-b border-border/50">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Developer Profile</h2>
          <p className="text-muted-foreground mt-1">Manage your identity and view your stats.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center p-6 bg-card/50 border border-border/50 rounded-2xl shadow-sm">
            <div className="relative group cursor-pointer" onClick={() => document.getElementById('avatar-upload')?.click()}>
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary/20 bg-secondary flex items-center justify-center text-4xl font-bold text-muted-foreground">
                {avatar ? (
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  nickname.substring(0, 2).toUpperCase() || 'KY'
                )}
              </div>
              <div 
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center rounded-full text-white cursor-pointer"
              >
                <Camera className="w-8 h-8 mb-1" />
                <span className="text-xs font-bold">Change</span>
              </div>
              <input 
                id="avatar-upload"
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
            
            <div className="w-full space-y-4 mt-6">
              <div className="space-y-1.5">
                <Label htmlFor="nickname">Nickname</Label>
                <Input 
                  id="nickname" 
                  value={nickname} 
                  onChange={(e) => setNickname(e.target.value)} 
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <div className="flex relative items-center">
                  <span className="absolute left-3 text-muted-foreground text-sm">@</span>
                  <Input 
                    id="username" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} 
                    className="bg-secondary border-border pl-7"
                    placeholder="developer"
                  />
                </div>
              </div>
              <Button onClick={handleSave} disabled={isSaving} className="w-full mt-2">
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          {/* Stats Section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-card/50 border border-border/50 rounded-2xl flex items-start gap-4">
              <div className={`p-3 rounded-xl ${activeBadge ? activeBadge.color.replace('text-', 'bg-').replace('-500', '-500/20') : 'bg-primary/20'} ${activeBadge ? activeBadge.color : 'text-primary'}`}>
                {BadgeIcon ? <BadgeIcon className="w-6 h-6" /> : <Award className="w-6 h-6" />}
              </div>
              <div>
                <div className="text-sm text-muted-foreground font-semibold">Current Level</div>
                <div className="text-3xl font-black">{data.level}</div>
                <div className={`text-xs font-bold mt-1 uppercase tracking-widest ${activeBadge ? activeBadge.color : 'text-primary/80'}`}>{activeTitle}</div>
              </div>
            </div>

            <div className="p-6 bg-card/50 border border-border/50 rounded-2xl flex items-start gap-4">
              <div className="p-3 rounded-xl bg-amber-500/20 text-amber-500">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground font-semibold">Total Coins</div>
                <div className="text-3xl font-black">{data.coins}</div>
                <div className="text-xs text-amber-500/80 font-bold mt-1">Ready to spend</div>
              </div>
            </div>

            <div className="p-6 bg-card/50 border border-border/50 rounded-2xl flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-500/20 text-blue-500">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground font-semibold">Total Uptime</div>
                <div className="text-3xl font-black">{(data.total_uptime_minutes / 60).toFixed(1)} <span className="text-lg">hrs</span></div>
                <div className="text-xs text-blue-500/80 font-bold mt-1">{data.total_uptime_minutes} minutes tracked</div>
              </div>
            </div>

            <div className="p-6 bg-card/50 border border-border/50 rounded-2xl flex items-start gap-4">
              <div className="p-3 rounded-xl bg-purple-500/20 text-purple-500">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground font-semibold">Achievements</div>
                <div className="text-3xl font-black">{data.unlocked_achievements.length}</div>
                <div className="text-xs text-purple-500/80 font-bold mt-1">Unlocked so far</div>
              </div>
            </div>
          </div>

          {/* Level Progress */}
          <div className="p-6 bg-card/50 border border-border/50 rounded-2xl space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="font-bold text-lg">Level Progress</h3>
                <p className="text-sm text-muted-foreground">You need {xpNeeded - data.current_xp} more XP to reach Level {data.level + 1}.</p>
              </div>
              <div className="text-xl font-black text-primary">
                {data.current_xp} <span className="text-muted-foreground text-sm font-normal">/ {xpNeeded} XP</span>
              </div>
            </div>
            <Progress value={progressPercent} className="h-4" />
          </div>

          {/* Danger Zone */}
          <div className="p-6 bg-destructive/5 border border-destructive/20 rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-destructive">Danger Zone</h3>
                <p className="text-sm text-muted-foreground">Permanently delete your progress and reset your account.</p>
              </div>
              
              <Dialog>
                <DialogTrigger >
                  <Button variant="destructive">Delete Account</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Are you absolutely sure?</DialogTitle>
                    <DialogDescription>
                      This action cannot be undone. This will permanently delete your gamification progress, coins, achievements, and purchased items.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="mt-4 gap-2 sm:gap-0">
                    <DialogClose >
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <DialogClose >
                      <Button variant="destructive" onClick={handleDeleteAccount}>
                        Yes, delete my account
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
