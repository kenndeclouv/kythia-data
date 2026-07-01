import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { toast } from "sonner";

// Intercept toast calls to use macOS style format (Title + Description)
const originalSuccess = toast.success;
const originalError = toast.error;
const originalInfo = toast.info;
const originalWarning = toast.warning;

const wrapIcon = (icon: any) => {
  if (icon) {
    return (
      <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-white/10 text-white text-[18px] shadow-sm [&_svg]:size-[18px]">
        {icon}
      </div>
    );
  }
  return icon;
};

(toast as any).success = (msg: string | React.ReactNode, data?: any) => {
  const newData = { ...data };
  if (newData.icon) newData.icon = wrapIcon(newData.icon);
  if (typeof msg === 'string' && !newData.description) return originalSuccess("Success", { ...newData, description: msg });
  return originalSuccess(msg, newData);
};
(toast as any).error = (msg: string | React.ReactNode, data?: any) => {
  const newData = { ...data };
  if (newData.icon) newData.icon = wrapIcon(newData.icon);
  if (typeof msg === 'string' && !newData.description) return originalError("Error", { ...newData, description: msg });
  return originalError(msg, newData);
};
(toast as any).info = (msg: string | React.ReactNode, data?: any) => {
  const newData = { ...data };
  if (newData.icon) newData.icon = wrapIcon(newData.icon);
  if (typeof msg === 'string' && !newData.description) return originalInfo("Info", { ...newData, description: msg });
  return originalInfo(msg, newData);
};
(toast as any).warning = (msg: string | React.ReactNode, data?: any) => {
  const newData = { ...data };
  if (newData.icon) newData.icon = wrapIcon(newData.icon);
  if (typeof msg === 'string' && !newData.description) return originalWarning("Warning", { ...newData, description: msg });
  return originalWarning(msg, newData);
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
