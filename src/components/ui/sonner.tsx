import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      icons={{
        success: (
          <div className="flex size-[34px] items-center justify-center rounded-[10px] bg-green-500/15 text-green-500">
            <CircleCheckIcon className="size-[18px]" />
          </div>
        ),
        info: (
          <div className="flex size-[34px] items-center justify-center rounded-[10px] bg-blue-500/15 text-blue-500">
            <InfoIcon className="size-[18px]" />
          </div>
        ),
        warning: (
          <div className="flex size-[34px] items-center justify-center rounded-[10px] bg-amber-500/15 text-amber-500">
            <TriangleAlertIcon className="size-[18px]" />
          </div>
        ),
        error: (
          <div className="flex size-[34px] items-center justify-center rounded-[10px] bg-red-500/15 text-red-500">
            <OctagonXIcon className="size-[18px]" />
          </div>
        ),
        loading: (
          <div className="flex size-[34px] items-center justify-center rounded-[10px] bg-white/10 text-white">
            <Loader2Icon className="size-[18px] animate-spin" />
          </div>
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "group relative flex w-full items-start !rounded-xl border border-white/5 bg-[#1c1c1e]/95 p-4 pr-12 shadow-2xl backdrop-blur-xl after:absolute after:right-4 after:top-4 after:text-[11px] after:text-white/30 after:content-['now']",
          content: "flex flex-col gap-0.5 flex-1 ml-[42px] !m-0 !ml-[42px]",
          title: "text-[15px] font-semibold tracking-tight text-white mt-0.5",
          description: "text-[13px] text-white/60",
          icon: "mt-0.5 absolute left-4 flex size-[34px] items-center justify-center",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
