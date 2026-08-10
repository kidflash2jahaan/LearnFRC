"use client";

import * as React from "react";
import { SuggestEdit } from "@/components/lesson/suggest-edit";

/**
 * Article edit control. Article pages are statically generated (for SEO), so
 * login state can't come from the server — this thin client wrapper checks
 * /api/me on mount and renders the shared SuggestEdit accordingly. The page
 * itself stays static.
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
