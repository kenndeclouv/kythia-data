import { getVersion } from '@tauri-apps/api/app';
import { useEffect, useState } from 'react';
import kythiaLogo from '../assets/kythia-app-logo.webp';

export function About() {
  const [version, setVersion] = useState<string>('0.1.0');

  useEffect(() => {
    getVersion().then(v => setVersion(v)).catch(() => { });
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">

      <div className="space-y-12 pb-10">
        <section>
          <img src={kythiaLogo} alt="Kythia Logo" className="w-[128px] h-[128px] shadow-md mb-4" />
          
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-3xl font-extrabold tracking-tight text-foreground">Kythia Data</h3>
              <p className="text-base text-muted-foreground font-medium mt-1">Version {version}</p>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="space-y-4">
            <p className="leading-relaxed">
              Kythia Data is a lightning-fast, ultra-modern native database client for Windows.
              Built with Rust and Tauri, it provides a seamless experience for connecting, querying, and managing your databases directly from a beautiful and intuitive UI.
            </p>
            <p className="leading-relaxed">
              Designed as a sleek alternative to traditional tools like phpMyAdmin, DBeaver, or DataGrip, Kythia Data focuses on raw speed, simplicity, and an unmatched developer experience.
            </p>
          </div>

          <div className="border-t pt-6 flex flex-col space-y-2">
            <p className="text-foreground font-semibold">Useful links</p>
            <div className="flex flex-col space-y-1">
              <a href="https://kenndeclouv.com" target="_blank" className="text-primary hover:text-primary/80 transition-color duration-200">kenndeclouv.com</a>
              <a href="https://github.com/kenndeclouv" target="_blank" className="text-primary hover:text-primary/80 transition-color duration-200">github</a>
              <a href="https://github.com/kenndeclouv/kythia-data" target="_blank" className="text-primary hover:text-primary/80 transition-color duration-200">view source</a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
