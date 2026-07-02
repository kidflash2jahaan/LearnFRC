/**
 * Arena Clay route transition — a soft rise + fade fired on every navigation
 * (mounted from app/template.tsx, which remounts per route).
 *
 * Implemented in pure CSS (`.aq-route` in globals.css) rather than
 * framer-motion: useReducedMotion() differs between SSR (unknown -> false)
 * and the client, so branching the TREE on it caused a hydration mismatch on
 * every page. CSS animations keep the tree identical and are disabled by the
 * global prefers-reduced-motion block.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return <div className="ac-route">{children}</div>;
}
