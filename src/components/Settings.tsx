import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { AppSettings } from '../types';
import { useTheme } from './theme-provider';

interface SettingsProps {
  onSettingsSaved?: () => void;
}

export function Settings({ onSettingsSaved }: SettingsProps) {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [showLicense, setShowLicense] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');

  const isFirstLoad = useRef(true);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (isFirstLoad.current) {
      if (settings !== null) {
        isFirstLoad.current = false;
      }
      return;
    }

    const autoSave = async () => {
      if (!settings) return;
      try {
        await invoke('save_settings', { settings });
        if (onSettingsSaved) onSettingsSaved();
      } catch (e: any) {
        toast.error(`Failed to auto-save settings: ${e}`);
      }
    };

    const timeout = setTimeout(autoSave, 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const loadSettings = async () => {
    try {
      const s = await invoke<AppSettings>('get_settings');
      setSettings(s);
    } catch (e) {
      toast.error('Failed to load settings');
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      await invoke('clear_all_cache');
      localStorage.clear();
      toast.success('All cache cleared successfully! You may need to restart the app or reload the page to fetch fresh data.');
    } catch (e: any) {
      toast.error(`Failed to clear cache: ${e}`);
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault();

    if (licenseKey === 'KYTH-COIN-2705-GIFT') {
      try {
        await invoke('add_coins', { amount: 100 });
        toast.success("Cheat Code Activated! +100 Coins", {
          duration: 3000,
          position: 'top-center',
          icon: <Sparkles />
        });
        window.dispatchEvent(new Event('gamification-update'));
        setLicenseKey('');
        return; // Don't close the modal so they can repeat it easily!
      } catch (err) {
        toast.error("Cheat failed.");
      }
    }

    if (licenseKey.trim().length > 0) {
      toast.success("Just kidding! Kythia Data is and always will be 100% free! 🎉", {
        duration: 5000,
        position: 'top-center',
        style: { fontSize: '1.1rem', padding: '16px' }
      });
      setLicenseKey('');
      setTimeout(() => setShowLicense(false), 3000);
    }
  };

  if (!settings) return null;

  if (showLicense) {
    return (
      <div className="w-full">
        <div className="max-w-5xl mx-auto w-full">
          <div className="space-y-10 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-extrabold tracking-tight">Upgrade to Kythia Pro</h2>
              <p className="text-muted-foreground">Unlock the ultimate developer experience. Enter your license key below to activate all premium features.</p>
            </div>

            <form onSubmit={handleActivateLicense} className="w-full space-y-4 max-w-lg mx-auto">
              <Input
                value={licenseKey}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                  if (val.length > 16) val = val.substring(0, 16);
                  const parts = [];
                  for (let i = 0; i < val.length; i += 4) {
                    parts.push(val.substring(i, i + 4));
                  }
                  setLicenseKey(parts.join('-'));
                }}
                maxLength={19}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="text-center text-2xl tracking-widest uppercase h-14 font-mono"
                autoFocus
              />
              <div className="flex gap-4 w-full">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowLicense(false)}>Cancel</Button>
                <Button type="submit" className="flex-1">Activate Now</Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="max-w-5xl mx-auto w-full">
        <div className="space-y-10 animate-in fade-in duration-500">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
              <p className="text-muted-foreground text-sm">Manage your workspace configuration and preferences.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleClearCache} disabled={isClearingCache} variant="outline" className="w-full sm:w-auto shadow-sm">
                {isClearingCache ? 'Clearing...' : 'Clear Cache'}
              </Button>
            </div>
          </div>

          <section>
            <div className="mb-6">
              <h3 className="text-2xl font-semibold tracking-tight">Appearance</h3>
              <p className="text-sm text-muted-foreground mt-1">Customize how Kythia Workspace looks.</p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="theme" className="flex-1">Theme</Label>
                <div>
                  <Select
                    value={theme}
                    onValueChange={(v) => setTheme(v as any)}
                  >
                    <SelectTrigger id="theme">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </section>


          <section className="border-t border-border/70 pt-8">
            <div className="mb-6">
              <h3 className="text-2xl font-semibold tracking-tight">System Tray & Startup</h3>
              <p className="text-sm text-muted-foreground mt-1">Configure how Kythia behaves in Windows.</p>
            </div>
            <div className="space-y-6">
                <div className="flex items-center justify-between p-3 border border-border/50 bg-card/30 rounded-xl">
                  <div>
                    <Label htmlFor="native_notifications">OS Native Notifications</Label>
                    <div className="text-xs text-muted-foreground mt-1">Receive alerts directly in Windows/Mac notification center</div>
                  </div>
                  <Switch 
                    id="native_notifications" 
                    checked={settings.native_notifications} 
                    onCheckedChange={(c) => setSettings({...settings, native_notifications: c})}
                  />
                </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autostart">Launch on Startup</Label>
                  <div className="text-sm text-muted-foreground">
                    Automatically start Kythia Workspace when you log in.
                  </div>
                </div>
                <Switch
                  id="autostart"
                  checked={settings.autostart}
                  onCheckedChange={(c) => setSettings({ ...settings, autostart: c })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="close_to_tray">Close to Tray</Label>
                  <div className="text-sm text-muted-foreground">
                    Clicking the 'X' button will minimize Kythia to the system tray instead of quitting.
                  </div>
                </div>
                <Switch
                  id="close_to_tray"
                  checked={settings.close_to_tray}
                  onCheckedChange={(c) => setSettings({ ...settings, close_to_tray: c })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="minimize_to_tray">Minimize to Tray</Label>
                  <div className="text-sm text-muted-foreground">
                    Minimizing the window will hide it to the system tray.
                  </div>
                </div>
                <Switch
                  id="minimize_to_tray"
                  checked={settings.minimize_to_tray}
                  onCheckedChange={(c) => setSettings({ ...settings, minimize_to_tray: c })}
                />
              </div>
            </div>
          </section>

          <div className="mt-12 border-t border-border/70 pt-8 text-center text-xs text-muted-foreground pb-8">
            <button onClick={() => setShowLicense(true)} className="text-primary hover:text-primary/80 transition-color duration-200">
              Activate Kythia Pro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
