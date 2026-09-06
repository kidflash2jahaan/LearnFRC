/**
 * The theme boundary. There is exactly one theme.
 *
 * This used to wrap `next-themes` with `forcedTheme="dark"`, which meant the
 * site shipped a theme runtime and a render-blocking inline script in order to
 * stamp a class it then forced to a single value. The notebook is one artifact,
 * printed once: six colours, no dark mode, nothing to switch. `color-scheme` is
 * declared on `:root` in globals.css so the browser paints its own chrome to
 * match, and that is the whole of it.
 *
 * The component stays because it is the honest place for the site to say it has
 * one theme, and because it is where a second one would have to be introduced
 * if that ever changed. Nothing below it may read a theme value. It holds no
 * state, so it is a Server Component and costs the client nothing.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
