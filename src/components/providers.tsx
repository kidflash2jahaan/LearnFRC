import type { CSSProperties } from "react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { CommandPalette } from "@/components/search/command-palette";

/**
 * A toast is a correction slip: a small piece of the same card stock, dropped
 * onto the page, with the same 2px ink border and the same offset ink drop as
 * every other surface in the binder.
 *
 * The styles go on `toastOptions.style` rather than a class, deliberately.
 * Sonner injects its own stylesheet unlayered, and everything this project
 * writes lives in a Tailwind cascade layer, so a class would always lose to
 * sonner's default 8px radius and blurred grey shadow no matter how specific it
 * was. An inline style wins outright and needs no `!important` to do it.
 *
 * `richColors` is off: it paints success green and error red, which is two more
 * colours than this system owns. Sonner still draws its own type icon, so a
 * success and an error are still told apart without them.
 */
const SLIP: CSSProperties = {
  background: "var(--card)",
  color: "var(--ink)",
  border: "2px solid var(--ink)",
  borderRadius: "var(--hand-s)",
  boxShadow: "var(--drop-ink)",
  fontFamily: "var(--font-bricolage), Archivo, Helvetica, Arial, sans-serif",
  fontSize: "0.95rem",
  lineHeight: "1.45",
};

// The close button and the swipe affordance read these off the container.
const TOASTER_VARS = {
  "--normal-bg": "var(--card)",
  "--normal-text": "var(--ink)",
  "--normal-border": "var(--ink)",
  "--border-radius": "var(--hand-s)",
} as CSSProperties;

/**
 * Everything the whole site mounts once, below the root layout.
 *
 * This is a Server Component: the three things inside it are their own client
 * boundaries, so wrapping them in a fourth one would have pulled the entire
 * page tree across with it for no reason.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <CommandPalette />
      <Toaster
        position="top-center"
        closeButton
        style={TOASTER_VARS}
        toastOptions={{ style: SLIP }}
      />
    </ThemeProvider>
  );
}
