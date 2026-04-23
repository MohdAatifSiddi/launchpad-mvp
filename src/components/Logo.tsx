import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "default" | "light";
  showWordmark?: boolean;
  className?: string;
}

export const Logo = ({ variant = "default", showWordmark = true, className }: LogoProps) => {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src={logo}
        alt="NyayAI logo — Devanagari न्याय with scales of justice"
        width={36}
        height={36}
        className="h-9 w-9 object-contain"
      />
      {showWordmark && (
        <div className="flex items-baseline gap-1.5 leading-none">
          <span className={cn("font-serif text-xl font-semibold tracking-tight", variant === "light" ? "text-sidebar-foreground" : "text-primary")}>
            Nyay<span className="text-accent">AI</span>
          </span>
          <span className={cn("font-deva text-sm", variant === "light" ? "text-sidebar-foreground/60" : "text-muted-foreground")}>न्याय</span>
        </div>
      )}
    </div>
  );
};
