import React from 'react';
import { Palette, Terminal, Waves, Flame, Zap, Music, Shield, Crown } from 'lucide-react';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  type: 'theme' | 'sound' | 'badge';
  cssVars?: Record<string, string>; // CSS variables to inject when equipped
  audioUrl?: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'theme_cyberpunk',
    name: 'Cyberpunk Red',
    description: 'High-octane neon red theme for maximum hacking speed.',
    cost: 500,
    icon: Flame,
    color: 'text-red-500',
    type: 'theme',
    cssVars: {
      '--primary': 'hsl(0, 100%, 50%)',
      '--ring': 'hsl(0, 100%, 50%)',
      '--sidebar-ring': 'hsl(0, 100%, 50%)',
      '--theme-sidebar-dark': 'hsl(0, 60%, 10%)',
      '--theme-sidebar-accent-dark': 'hsl(0, 100%, 20%)',
      '--theme-sidebar-light': 'hsl(0, 100%, 98%)',
      '--theme-sidebar-accent-light': 'hsl(0, 100%, 94%)',
    }
  },
  {
    id: 'theme_matrix',
    name: 'Matrix Hacker',
    description: 'Wake up, Neo. The classic green terminal look.',
    cost: 500,
    icon: Terminal,
    color: 'text-green-500',
    type: 'theme',
    cssVars: {
      '--primary': 'hsl(142, 70%, 45%)',
      '--ring': 'hsl(142, 70%, 45%)',
      '--sidebar-ring': 'hsl(142, 70%, 45%)',
      '--theme-sidebar-dark': 'hsl(142, 60%, 10%)',
      '--theme-sidebar-accent-dark': 'hsl(142, 70%, 20%)',
      '--theme-sidebar-light': 'hsl(142, 100%, 98%)',
      '--theme-sidebar-accent-light': 'hsl(142, 100%, 94%)',
    }
  },
  {
    id: 'theme_ocean',
    name: 'Deep Ocean',
    description: 'A calming deep blue theme for focused coding sessions.',
    cost: 500,
    icon: Waves,
    color: 'text-blue-500',
    type: 'theme',
    cssVars: {
      '--primary': 'hsl(221, 83%, 53%)',
      '--ring': 'hsl(221, 83%, 53%)',
      '--sidebar-ring': 'hsl(221, 83%, 53%)',
      '--theme-sidebar-dark': 'hsl(221, 60%, 10%)',
      '--theme-sidebar-accent-dark': 'hsl(221, 83%, 20%)',
      '--theme-sidebar-light': 'hsl(221, 100%, 98%)',
      '--theme-sidebar-accent-light': 'hsl(221, 100%, 94%)',
    }
  },
  {
    id: 'theme_amethyst',
    name: 'Royal Amethyst',
    description: 'Elegant purple theme for the kings of code.',
    cost: 750,
    icon: Palette,
    color: 'text-purple-500',
    type: 'theme',
    cssVars: {
      '--primary': 'hsl(262, 83%, 57%)',
      '--ring': 'hsl(262, 83%, 57%)',
      '--sidebar-ring': 'hsl(262, 83%, 57%)',
      '--theme-sidebar-dark': 'hsl(262, 60%, 10%)',
      '--theme-sidebar-accent-dark': 'hsl(262, 83%, 20%)',
      '--theme-sidebar-light': 'hsl(262, 100%, 98%)',
      '--theme-sidebar-accent-light': 'hsl(262, 100%, 94%)',
    }
  },
  {
    id: 'theme_gold',
    name: 'Golden Era',
    description: 'Flex your wealth with this solid gold theme.',
    cost: 1500,
    icon: Zap,
    color: 'text-yellow-500',
    type: 'theme',
    cssVars: {
      '--primary': 'hsl(47, 95%, 53%)',
      '--ring': 'hsl(47, 95%, 53%)',
      '--sidebar-ring': 'hsl(47, 95%, 53%)',
      '--theme-sidebar-dark': 'hsl(47, 60%, 10%)',
      '--theme-sidebar-accent-dark': 'hsl(47, 95%, 20%)',
      '--theme-sidebar-light': 'hsl(47, 100%, 98%)',
      '--theme-sidebar-accent-light': 'hsl(47, 100%, 94%)',
    }
  },
  {
    id: 'sound_anime',
    name: 'Anime Voice Pack',
    description: 'Plays "Ara ara" when you start a service. Motivation +1000%.',
    cost: 1000,
    icon: Music,
    color: 'text-pink-400',
    type: 'sound',
    audioUrl: 'https://www.myinstants.com/media/sounds/ara-ara_-sound-effect.mp3'
  },
  {
    id: 'badge_bug_hunter',
    name: 'Bug Hunter',
    description: 'A shiny badge that shows you squash bugs for breakfast.',
    cost: 500,
    icon: Shield,
    color: 'text-green-500',
    type: 'badge'
  },
  {
    id: 'badge_10x',
    name: '10x Developer',
    description: 'For those who code faster than their own shadow.',
    cost: 2000,
    icon: Zap,
    color: 'text-amber-500',
    type: 'badge'
  },
  {
    id: 'badge_server_lord',
    name: 'Server Lord',
    description: 'The ultimate badge. Servers bow to your command.',
    cost: 5000,
    icon: Crown,
    color: 'text-purple-500',
    type: 'badge'
  }
];
