"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Button, Empty, Result, Skeleton } from "antd";
import { tr, trData } from "@/lib/i18n";

/** Card grid used by every training shelf: 1 → 2 → 3 columns. */
export const CARD_GRID = "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-7";

/**
 * A titled row of cards: shows `limit` (3) items, then "Show more" adds 3 at a time.
 * "See all" links to the full list when `viewAllHref` is set.
 */
export default function Shelf<T>({
  title,
  subtitle,
  items,
  render,
  limit = 3,
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
    <section className="flex flex-col gap-4" aria-label={trData(title)}>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="m-0 text-xl font-bold text-slate-900">
            {trData(title)}
            {list.length > 0 && <span className="ml-2 text-base font-normal text-slate-400">{list.length}</span>}
          </h2>
          {subtitle && <p className="m-0 mt-0.5 text-sm text-slate-500">{trData(subtitle)}</p>}
        </div>
        {viewAllHref && list.length > 0 && (
          <Link href={viewAllHref} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
            {tr("See all")}
          </Link>
        )}
      </div>

      {loading ? (
        <div className={CARD_GRID}>
          {Array.from({ length: limit }, (_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton.Node active style={{ width: "100%", height: 150, borderRadius: 16 }} />
              <Skeleton active title={false} paragraph={{ rows: 2 }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <Result
          status="warning"
          title={tr("Couldn't load this section")}
          subTitle={trData(error)}
          extra={onRetry ? <Button onClick={onRetry}>{tr("Try again")}</Button> : undefined}
          style={{ padding: 16 }}
        />
      ) : list.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-6">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText ?? tr("Nothing here yet")} />
        </div>
      ) : (
        <>
          <div className={CARD_GRID}>{list.slice(0, shown).map(render)}</div>
          {list.length > limit && (
            <div className="flex gap-2 justify-center">
              {shown < list.length && (
                <Button shape="round" onClick={() => setShown((n) => n + limit)}>
                  {tr("Show more ({count})", { count: list.length - shown })}
                </Button>
              )}
              {shown > limit && <Button type="text" shape="round" onClick={() => setShown(limit)}>{tr("Show less")}</Button>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
