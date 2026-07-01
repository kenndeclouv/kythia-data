import { HashRouter as Router, Routes, Route, useParams } from "react-router-dom";
import Sidebar from "./components/layout/Sidebar";
import MainContent from "./components/layout/MainContent";
import CreateConnectionModal from "./components/connection/CreateConnectionModal";
import SelectDatabaseModal from "./components/connection/SelectDatabaseModal";
import WorkspaceLayout from "./components/workspace/WorkspaceLayout";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Profile } from "./components/Profile";
import { Settings } from "./components/Settings";
import { About } from "./components/About";
import { Achievements } from "./components/Achievements";
import { Shop } from "./components/Shop";
import { Backups } from "./components/Backups";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "./components/ui/sonner";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "./components/ui/sidebar";
import { TooltipProvider } from "./components/ui/tooltip";
import { invoke } from "@tauri-apps/api/core";
import { SHOP_ITEMS } from "./lib/shop";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { GamificationBadge } from "./components/GamificationBadge";
import { getCurrentWindow } from "@tauri-apps/api/window";
import loadingAnimation from "./assets/loading-animation.webp";

function MainWindow({ children }: { children?: React.ReactNode }) {
  const handleOpenSelect = () => {
    new WebviewWindow("select-db", {
      url: "/#/select-db",
      title: "Select Database",
      width: 800,
      height: 520,
      center: true,
      resizable: false,
    });
  };

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
          {/* App Sidebar */}
          <Sidebar onCreateConnection={handleOpenSelect} />

          {/* Main Content Area */}
          <SidebarInset className="flex-1 flex flex-col overflow-hidden bg-background relative">
            <main className="flex-1 overflow-auto p-8 flex flex-col relative z-10 app-region-drag-disable">
              <header className="mb-2 flex items-center justify-between app-region-drag">
                <SidebarTrigger className="-ml-2 app-region-no-drag" />
                <div className="app-region-no-drag">
                  <GamificationBadge />
                </div>
              </header>
              <div className="flex-1 flex flex-col app-region-no-drag">
                {children}
              </div>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function CreateConnectionWrapper() {
  const { dbType } = useParams<{ dbType: string }>();

  if (dbType === "mysql" || dbType === "mariadb") {
    return <CreateConnectionModal />;
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
      <h2>Support for {dbType} is coming soon!</h2>
    </div>
  );
}

function EditConnectionWrapper() {
  const { index } = useParams<{ index: string }>();
  return <CreateConnectionModal editIndex={parseInt(index || "0", 10)} />;
}

function WorkspaceWrapper() {
  const { index } = useParams<{ index: string }>();
  return <WorkspaceLayout index={parseInt(index || "0", 10)} />;
}

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unlisten: () => void;
    
    const setupWindowEvents = async () => {
      try {
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onResized(async () => {
          const isMin = await appWindow.isMinimized();
          if (isMin) {
            const settings = await invoke<any>('get_settings');
            if (settings.minimize_to_tray) {
              appWindow.hide();
            }
          }
        });
      } catch (e) {
        console.error("Failed to setup window events:", e);
      }
    };
    
    setupWindowEvents();
    
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    const applyTheme = async () => {
      try {
        const gamificationData = await invoke<any>('get_gamification_data');
        const theme = SHOP_ITEMS.find(t => t.id === gamificationData.active_theme);
        if (theme && theme.cssVars) {
          Object.entries(theme.cssVars).forEach(([key, val]) => {
            document.documentElement.style.setProperty(key, val);
          });
        } else {
          document.documentElement.style.removeProperty('--primary');
          document.documentElement.style.removeProperty('--ring');
          document.documentElement.style.removeProperty('--sidebar-ring');
          document.documentElement.style.removeProperty('--sidebar');
          document.documentElement.style.removeProperty('--sidebar-accent');
        }
        
        setTimeout(() => {
          setIsLoading(false);
        }, 600); // Wait a bit to show the loading screen smoothly
      } catch (e) {
        setIsLoading(false);
      }
    };

    applyTheme();

    // Listen for cross-window updates (if any)
    const handleUpdate = () => applyTheme();
    window.addEventListener('gamification-update', handleUpdate);
    return () => window.removeEventListener('gamification-update', handleUpdate);
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {isLoading ? (
        <div className="flex h-screen w-full bg-background text-foreground items-center justify-center flex-col space-y-8 relative overflow-hidden">
          {/* Decorative background blurs */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-secondary/20 rounded-full blur-2xl" />
          
          <div className="relative w-48 h-48 flex items-center justify-center">
            <img src={loadingAnimation} alt="Loading Animation" />
          </div>
          
          <div className="relative flex flex-col items-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground">KYTHIA</h2>
            <div className="text-sm text-muted-foreground uppercase tracking-[0.3em] font-medium mt-2 flex items-center gap-2">
              <span>Initializing Kythia Data</span>
              <Loader2 className="w-3 h-3 text-primary animate-spin" />
            </div>
          </div>
        </div>
      ) : (
        <Router>
        <Routes>
          <Route path="/" element={<MainWindow><MainContent onCreateConnection={() => {
            new WebviewWindow("select-db", {
              url: "/#/select-db", title: "Select Database", width: 800, height: 520, center: true, resizable: false,
            });
          }} /></MainWindow>} />
          <Route path="/profile" element={<MainWindow><Profile /></MainWindow>} />
          <Route path="/settings" element={<MainWindow><Settings /></MainWindow>} />
          <Route path="/about" element={<MainWindow><About /></MainWindow>} />
          <Route path="/achievements" element={<MainWindow><Achievements /></MainWindow>} />
          <Route path="/shop" element={<MainWindow><Shop /></MainWindow>} />
          <Route path="/backups" element={<MainWindow><Backups /></MainWindow>} />
          <Route path="/select-db" element={<SelectDatabaseModal />} />
          <Route path="/create-connection/:dbType" element={<CreateConnectionWrapper />} />
          <Route path="/edit-connection/:index" element={<EditConnectionWrapper />} />
          <Route path="/workspace/:index" element={<WorkspaceWrapper />} />
        </Routes>
        </Router>
      )}
      <Toaster position="top-center" />
    </ThemeProvider>
  );
}

export default App;
