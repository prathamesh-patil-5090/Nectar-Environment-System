"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Button, Empty, Result, Skeleton } from "antd";
import styles from "./training.module.css";

/**
 * A titled row of cards: shows `limit` (4) items, then "Show more" adds 4 at a time.
 * "View all" links to the full list when `viewAllHref` is set.
 */
export default function Shelf<T>({
  title,
  subtitle,
  items,
  render,
  limit = 4,
  viewAllHref,
  emptyText,
  loading,
  error,
  onRetry,
  hideWhenEmpty,
}: {
  title: string;
  subtitle?: string;
  items: T[] | undefined;
  render: (item: T) => ReactNode;
  limit?: number;
  viewAllHref?: string;
  emptyText?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  hideWhenEmpty?: boolean;
}) {
  const [shown, setShown] = useState(limit);
  const list = items ?? [];
  if (!loading && !error && hideWhenEmpty && list.length === 0) return null;

  return (
    <section className={styles.shelf} aria-label={title}>
      <div className={styles.shelfHead}>
        <div>
          <h2 className={styles.shelfTitle}>
            {title}
            {list.length > 0 && <span style={{ fontWeight: 500, color: "#4A6375", fontSize: 14 }}> · {list.length}</span>}
          </h2>
          {subtitle && <p className={styles.shelfSub}>{subtitle}</p>}
        </div>
        {viewAllHref && list.length > limit && <Link href={viewAllHref}>View all</Link>}
      </div>

      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: limit }, (_, i) => (
            <div key={i} className={styles.panel}>
              <Skeleton active paragraph={{ rows: 3 }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <Result
          status="warning"
          title="Couldn't load this section"
          subTitle={error}
          extra={onRetry ? <Button onClick={onRetry}>Try again</Button> : undefined}
          style={{ padding: 16 }}
        />
      ) : list.length === 0 ? (
        <div className={styles.panel}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText ?? "Nothing here yet"} />
        </div>
      ) : (
        <>
          <div className={styles.grid}>{list.slice(0, shown).map(render)}</div>
          {list.length > limit && (
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              {shown < list.length && (
                <Button onClick={() => setShown((n) => n + limit)}>
                  Show more ({list.length - shown} more)
                </Button>
              )}
              {shown > limit && <Button type="text" onClick={() => setShown(limit)}>Show less</Button>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
