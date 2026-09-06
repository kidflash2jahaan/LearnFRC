/**
 * Route transition for the notebook.
 *
 * A template remounts whenever its own segment key changes, so this wrapper
 * fires once per navigation. The old system did a 500ms rise-and-fade; that
 * is the wrong gesture here twice over. The binder is flat paper, so nothing
 * should look like it is floating up off the page, and a `transform` on a
 * wrapper this high in the tree makes it the containing block for every
 * `position: fixed` descendant, which quietly breaks sticky headers, dialogs
 * and toasts on the way in.
 *
 * `.nb-route` is opacity only, 140ms, in two visible `steps()`: a page coming
 * off the copier in two passes. Pure CSS, so the SSR and client trees are
 * identical and there is nothing to hydrate. Reduced motion drops it to the
 * end state, so content is never left invisible.
 *
 * Server Component. It holds no state and must not become a client boundary.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="nb-route">{children}</div>;
}
