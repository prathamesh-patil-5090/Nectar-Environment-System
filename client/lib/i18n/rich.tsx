import { Fragment, type ReactNode } from "react";
import { tr, trData } from "./phrases";

/**
 * Translate a sentence whose placeholders are React nodes — links, <strong>,
 * tags — so the whole sentence is one catalogue entry and translators can move
 * the pieces to fit Hindi/Marathi word order.
 *
 *   trNode("Waiting for {name} to approve", { name: <strong>{n}</strong> })
 */
export function trNode(text: string, nodes: Record<string, ReactNode>): ReactNode {
  const translated = tr(text);
  const parts = translated.split(/\{(\w+)\}/);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <Fragment key={i}>{part in nodes ? nodes[part] : `{${part}}`}</Fragment>
    ) : (
      part
    ),
  );
}

/** antd column `render` for raw data cells: translates strings, passes everything else through. */
export function trCell(value: unknown): ReactNode {
  return typeof value === "string" ? trData(value) : (value as ReactNode);
}
