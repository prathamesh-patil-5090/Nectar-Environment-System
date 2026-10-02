"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "antd";
import { TODAY } from "@/lib/shift";
import { nectarColors } from "@/lib/theme";

const SHIFT_TABS = [
  { key: "/shifts", label: "Dashboard", href: "/shifts" },
  { key: "/shifts/master", label: "Shift Master", href: "/shifts/master" },
  { key: "/shifts/schedule", label: "Schedule", href: "/shifts/schedule" },
  { key: "/shifts/rotation", label: "Rotation", href: "/shifts/rotation" },
  {
    key: "/shifts/change-requests",
    label: "Change Requests",
    href: "/shifts/change-requests",
  },
  {
    key: "/shifts/reliever-allocation",
    label: "Reliever Allocation",
    href: "/shifts/reliever-allocation",
  },
  {
    key: "/shifts/manpower",
    label: "Manpower + Conflict",
    href: "/shifts/manpower",
  },
  {
    key: "/shifts/deviations",
    label: "Deviations",
    href: "/shifts/deviations",
  },
];

export default function ShiftsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Universal Shift Module Navigation Banner */}
      <div
        style={{
          background: nectarColors.white,
          borderRadius: 12,
          padding: 20,
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            fontSize: 22,
            fontWeight: 700,
            color: "#1C4463",
          }}
        >
          Shift rotation
        </div>
        <p
          style={{
            margin: "6px 0 14px",
            color: "#4A6375",
            fontSize: 13.5,
            maxWidth: 760,
          }}
        >
          Plan shifts forward — forecast gaps, allocate relievers, and avoid OT
          before the day starts. Current date: <strong>{TODAY}</strong>
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SHIFT_TABS.map((tab) => {
            const isActive =
              tab.href === "/shifts"
                ? pathname === "/shifts"
                : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link key={tab.key} href={tab.href}>
                <Button
                  type={isActive ? "primary" : "default"}
                  style={{
                    borderRadius: 8,
                    fontWeight: isActive ? 600 : 500,
                    backgroundColor: isActive ? "#1C4463" : undefined,
                    borderColor: isActive ? "#1C4463" : undefined,
                    color: isActive ? "#FFFFFF" : undefined,
                  }}
                >
                  {tab.label}
                </Button>
              </Link>
            );
          })}
        </div>
      </div>

      {children}
    </div>
  );
}
