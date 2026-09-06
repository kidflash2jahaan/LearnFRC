"use client";

import * as React from "react";
import { SuggestEdit } from "@/components/lesson/suggest-edit";

/**
 * The "found a mistake?" control at the foot of an article.
 *
 * There is no markup of its own here on purpose, and there should not be:
 * corrections have to look and behave identically whether the reader is on a
 * lesson or on an article, so the control itself is `SuggestEdit` and this is
 * only the piece that works out whether the reader is signed in.
 *
 * Article pages are statically generated for SEO, so login state cannot come
 * from the server. This thin client wrapper probes /api/me on mount and hands
 * the answer down; the page around it stays static.
 */
export function ArticleSuggestEdit({
  articleId,
  title,
  path,
  content,
  dense = false,
}: {
  articleId: string;
  title: string;
  path: string;
  content: string;
  /** Tighter spacing when rendered inside the provenance card. */
  dense?: boolean;
}) {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && d.authed) setIsLoggedIn(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SuggestEdit
      contentType="article"
      targetId={articleId}
      title={title}
      path={path}
      content={content}
      isLoggedIn={isLoggedIn}
      dense={dense}
    />
  );
}
