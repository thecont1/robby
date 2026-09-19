/**
 * SITE HEADER — the chrome shared by every page on the robby site.
 *
 * One component, one header. Brand lockup on the left (linking back to the
 * app homepage), centered subtitle, and a toolset on the right carrying
 * the theme toggle and the hamburger menu. The Home page also surfaces a
 * live compile-status line and an image-only concentration toggle behind
 * those props.
 *
 * The brand reads "troid & robby" — both names in DM Mono via the existing
 * `.brand-title` rule. Click anywhere on the lockup (logo + wordmark) to
 * return to the gallery; this is the canonical "home" affordance across
 * the site, so the ancillary pages (deck, demo, briefs, manual) feel
 * stitched into the same app.
 */

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { themeControlLabel } from "@/lib/visualModes";
import {
  BookOpen,
  FileText,
  Github,
  Info,
  Lightbulb,
  Menu,
  Play,
  Presentation,
} from "lucide-react";
import { Link } from "wouter";

export type SiteHeaderProps = {
  /** Live status line under the wordmark — only Home needs this. */
  compileState?: "checking" | "verified" | "error";
  compileLabel?: string;
  /** Image-only concentration toggle — only Home needs this. */
  imageOnly?: boolean;
  onToggleImageOnly?: () => void;
};

export function SiteHeader({
  compileState,
  compileLabel,
  imageOnly,
  onToggleImageOnly,
}: SiteHeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="site-header">
      <Link className="brand-lockup" href="/" aria-label="troid & robby — back to the gallery">
        <img src="/icons/robby-registration-mark_658aceee.png" alt="robby split registration disc" />
        <span className="brand-copy">
          <span className="brand-title">troid <span className="brand-amp">&amp;</span> robby <span className="brand-slash">/</span> <span className="brand-suffix">v1</span></span>
          {compileState && compileLabel ? (
            <span className={`compile-status ${compileState}`}>{compileLabel}</span>
          ) : null}
        </span>
      </Link>
      <span className="header-product-subtitle">The Reverse-Obverse Image Duality Compiler</span>
      <div className="header-actions header-toolset">
        {toggleTheme ? (
          <button
            type="button"
            className="feature-control icon-control"
            onClick={toggleTheme}
            aria-label={themeControlLabel(theme)}
            aria-pressed={theme === "dark"}
            title={themeControlLabel(theme)}
          >
            <img
              src={theme === "light" ? "/icons/thin-sunglasses_23303233.svg" : "/icons/regular-sunglasses_28c9e1cf.svg"}
              alt=""
            />
          </button>
        ) : null}
        {onToggleImageOnly && imageOnly !== undefined ? (
          <button
            type="button"
            className="feature-control icon-control image-only-toggle"
            onClick={onToggleImageOnly}
            aria-pressed={imageOnly}
            aria-label={imageOnly ? "Restore interface text" : "Enable image-only concentration mode"}
            title="Image-only concentration mode. Press Escape to return."
          >
            <img
              src={imageOnly ? "/icons/text-hidden_1b455537.svg" : "/icons/text-visible_5e9d8f58.svg"}
              alt=""
            />
          </button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="menu-control" aria-label="Open site menu" title="Site menu">
              <Menu size={18} strokeWidth={2.2} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="robby-menu-content">
            <DropdownMenuItem asChild><Link href="/manual"><BookOpen size={17} /> Language manual</Link></DropdownMenuItem>

            <DropdownMenuItem asChild><Link href="/about"><Info size={17} /> About</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/hackathon"><FileText size={17} /> Hackathon brief</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/concept"><Lightbulb size={17} /> Image-object concept</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><a href="/deck/"><Presentation size={17} /> Presentation deck</a></DropdownMenuItem>
            <DropdownMenuItem asChild><a href="/demo/"><Play size={17} /> Demo video</a></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><a href="https://github.com/thecont1/robby" target="_blank" rel="noreferrer"><Github size={17} /> View Source</a></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
