import type { CSSProperties, ReactNode } from "react";
import { sSerifText18InkMb12, sWhitePadR10Border } from "@/lib/styles";
import { trData } from "@/lib/i18n";

/** White titled panel used on leave, shift and overtime pages. Pages override box/title styles where they differ. */
export default function Panel({
  title,
  children,
  boxStyle = sWhitePadR10Border,
  titleStyle = sSerifText18InkMb12,
}: {
  title: string;
  children: ReactNode;
  boxStyle?: CSSProperties;
  titleStyle?: CSSProperties;
}) {
  return (
    <div style={boxStyle}>
      <div style={titleStyle}>{trData(title)}</div>
      {children}
    </div>
  );
}
