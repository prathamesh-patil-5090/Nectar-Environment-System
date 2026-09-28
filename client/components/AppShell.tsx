"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import gsap from "gsap";
import {
  Avatar,
  Badge,
  Dropdown,
  Layout,
  Menu,
  Modal,
  Spin,
  Typography,
  theme,
} from "antd";
import type { MenuProps } from "antd";
import {
  DashboardOutlined,
  TeamOutlined,
  EnvironmentOutlined,
  ReadOutlined,
  BookOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ClockCircleOutlined,
  ClusterOutlined,
  CalendarOutlined,
  ScheduleOutlined,
  SafetyCertificateOutlined,
  WalletOutlined,
  BellOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { getSession, logout, type SessionUser } from "@/lib/auth";
import { resetDemoLocalData } from "@/lib/demo-reset";
import { getEmployeeById, getSiteById } from "@/lib/mock-data";
import { getUnreadCount } from "@/lib/notifications";
import {
  canAssignOt,
  canViewLeaveManagement,
  canViewOtModule,
  canViewRelieverPoolNav,
  canViewShiftsNav,
  canViewSitesNav,
  normalizeRole,
  roleLabel,
  visibleShiftNavKeys,
} from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";
import { hydrateAllStoresFromApi } from "@/lib/sync";

const { Header, Sider, Content } = Layout;

const SIDER_COLLAPSED_KEY = "nectar-enviro-sider-collapsed";

const FLYOUT_TITLES: Record<string, string> = {
  leave: "Leave",
  shifts: "Shifts",
  overtime: "OverTime",
  academy: "Academy",
};

function readSiderCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SIDER_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSiderCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(SIDER_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

function submenuTitleText(label: unknown): string {
  if (typeof label === "string") return label;
  return "Menu";
}

function GsapFlyoutCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, x: -12, scale: 0.94 },
        {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: 0.28,
          ease: "power3.out",
        }
      );
    }
  }, []);

  return (
    <div ref={cardRef} className="nectar-sider-flyout-card">
      <div className="nectar-sider-flyout-title">{title}</div>
      {children}
    </div>
  );
}

const overtimeChildren = [
  { key: "/overtime/overview", label: "Overview" },
  { key: "/overtime/employees", label: "Employees" },
  { key: "/overtime/sites", label: "Sites" },
  { key: "/overtime/analysis", label: "Analysis & reports" },
];

const leaveChildren = [
  { key: "/leave", label: "Overview" },
  { key: "/leave/requests", label: "Requests" },
  { key: "/leave/management", label: "Management" },
];

const shiftChildren = [
  { key: "/shifts", label: "Dashboard" },
  { key: "/shifts/master", label: "Shift Master" },
  { key: "/shifts/schedule", label: "Schedule" },
  { key: "/shifts/rotation", label: "Rotation" },
  { key: "/shifts/change-requests", label: "Change Requests" },
  { key: "/shifts/reliever-allocation", label: "Reliever Allocation" },
  { key: "/shifts/deviations", label: "Deviations" },
];

// Full nav is built dynamically in AppShell from role (navItemsFiltered)

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/employees": "Employees",
  "/sites": "Sites",
  "/training": "Training",
  "/reliever-pool": "Reliever Pool",
  "/leave": "Leave Overview",
  "/leave/requests": "Leave Requests",
  "/leave/management": "Leave · Management",
  "/shifts": "Shift Rotation",
  "/shifts/master": "Shift Master",
  "/shifts/schedule": "Shift Schedule",
  "/shifts/rotation": "Shift Rotation",
  "/shifts/change-requests": "Shift Change Requests",
  "/shifts/reliever-allocation": "Reliever Allocation",
  "/shifts/deviations": "Shift Deviations",
  "/overtime/overview": "OT Overview",
  "/overtime/employees": "Employee OT",
  "/overtime/sites": "Site OT",
  "/overtime/analysis": "OT Analysis & Reports",
  "/overtime/assign": "Assign OT",
  "/notifications": "Notifications",
  "/certifications": "Certifications",
  "/salary": "Salary history",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const siderRef = useRef<HTMLDivElement>(null);
  const logoFullRef = useRef<HTMLDivElement>(null);
  const logoShortRef = useRef<HTMLDivElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);

  const setCollapsedPersisted = (next: boolean) => {
    setCollapsed(next);
    writeSiderCollapsed(next);
    if (next) setOpenKeys([]);
  };

  // GSAP: Animate logo swap on collapse/expand
  useEffect(() => {
    if (collapsed && logoShortRef.current) {
      gsap.fromTo(
        logoShortRef.current,
        { opacity: 0, scale: 0.65 },
        { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }
      );
    } else if (!collapsed && logoFullRef.current) {
      gsap.fromTo(
        logoFullRef.current,
        { opacity: 0, x: -14 },
        { opacity: 1, x: 0, duration: 0.35, ease: "power3.out" }
      );
    }
  }, [collapsed]);

  // GSAP: Stagger menu items on mount and collapse toggle
  useEffect(() => {
    if (ready && siderRef.current) {
      const items = siderRef.current.querySelectorAll(
        ".ant-menu-item, .ant-menu-submenu-title"
      );
      if (items.length > 0) {
        gsap.fromTo(
          items,
          { opacity: 0, x: -12 },
          {
            opacity: 1,
            x: 0,
            duration: 0.32,
            stagger: 0.02,
            ease: "power2.out",
            clearProps: "transform,opacity",
          }
        );
      }
    }
  }, [ready, collapsed]);

  // GSAP: Smooth accordion reveal for newly opened submenus
  useEffect(() => {
    if (!collapsed && siderRef.current && openKeys.length > 0) {
      const openSubItems = siderRef.current.querySelectorAll(
        ".ant-menu-submenu-open > .ant-menu-sub > .ant-menu-item"
      );
      if (openSubItems.length > 0) {
        gsap.fromTo(
          openSubItems,
          { opacity: 0, y: -6 },
          {
            opacity: 1,
            y: 0,
            duration: 0.28,
            stagger: 0.035,
            ease: "power2.out",
            clearProps: "transform,opacity",
          }
        );
      }
    }
  }, [openKeys, collapsed]);

  // Global live API hydration from MongoDB Atlas
  useEffect(() => {
    hydrateAllStoresFromApi().catch(() => {});
  }, []);

  // GSAP: Smooth magnetic hover on sidebar menu items
  useEffect(() => {
    const siderEl = siderRef.current;
    if (!siderEl) return;

    const handleMouseEnter = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest<HTMLElement>(
        ".ant-menu-item, .ant-menu-submenu-title"
      );
      if (target && !target.classList.contains("ant-menu-item-selected")) {
        gsap.to(target, {
          x: 4,
          duration: 0.22,
          ease: "power2.out",
        });
      }
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest<HTMLElement>(
        ".ant-menu-item, .ant-menu-submenu-title"
      );
      if (target) {
        gsap.to(target, {
          x: 0,
          duration: 0.25,
          ease: "power2.out",
        });
      }
    };

    siderEl.addEventListener("mouseover", handleMouseEnter);
    siderEl.addEventListener("mouseout", handleMouseLeave);
    return () => {
      siderEl.removeEventListener("mouseover", handleMouseEnter);
      siderEl.removeEventListener("mouseout", handleMouseLeave);
    };
  }, []);

  const handleToggleCollapse = () => {
    if (toggleBtnRef.current) {
      gsap.fromTo(
        toggleBtnRef.current,
        { scale: 0.82, rotate: collapsed ? -60 : 60 },
        { scale: 1, rotate: 0, duration: 0.35, ease: "back.out(2)" }
      );
    }
    setCollapsedPersisted(!collapsed);
  };

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    const id = requestAnimationFrame(() => {
      setUser(session);
      setCollapsed(readSiderCollapsed());
      setReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, [router]);

  useEffect(() => {
    if (collapsed) return;
    const extras: string[] = [];
    if (pathname.startsWith("/leave")) extras.push("leave");
    if (pathname.startsWith("/overtime")) extras.push("overtime");
    if (pathname.startsWith("/shifts") && canViewShiftsNav(user)) {
      extras.push("shifts");
    }
    const role = normalizeRole(user?.role);
    if (
      role === "employee" &&
      (pathname.startsWith("/training") || pathname.startsWith("/certifications"))
    ) {
      extras.push("academy");
    }
    if (!extras.length) return;
    const id = requestAnimationFrame(() => {
      setOpenKeys((keys) => {
        let changed = false;
        const next = [...keys];
        for (const k of extras) {
          if (!next.includes(k)) {
            next.push(k);
            changed = true;
          }
        }
        return changed ? next : keys;
      });
    });
    return () => cancelAnimationFrame(id);
  }, [pathname, collapsed, user]);

  const selectedKey = useMemo(() => {
    // 1. Leave routes
    if (pathname.startsWith("/leave/requests") || pathname.startsWith("/leave/pending")) {
      return "/leave/requests";
    }
    if (pathname.startsWith("/leave/management")) {
      return "/leave/management";
    }
    if (pathname === "/leave" || pathname.startsWith("/leave")) {
      return "/leave";
    }

    // 2. Shifts
    if (pathname === "/shifts") return "/shifts";
    if (pathname.startsWith("/shifts/")) {
      const match = shiftChildren.find(
        (c) => pathname === c.key || pathname.startsWith(`${c.key}/`),
      );
      return match?.key ?? "/shifts";
    }

    // 3. Overtime routes
    if (pathname.startsWith("/overtime/employees")) {
      return "/overtime/employees";
    }
    if (pathname.startsWith("/overtime/sites")) {
      return "/overtime/sites";
    }
    if (pathname.startsWith("/overtime/analysis") || pathname.startsWith("/overtime/reports")) {
      return "/overtime/analysis";
    }
    if (pathname.startsWith("/overtime/assign")) {
      return "/overtime/assign";
    }
    if (pathname.startsWith("/overtime/overview") || pathname === "/overtime") {
      return "/overtime/overview";
    }

    // 4. Employee directory vs own profile (own profile is navbar-only)
    if (pathname === "/employees" || pathname.startsWith("/employees/")) {
      return "/employees";
    }

    // 5. Direct match from pageTitles
    const match = Object.keys(pageTitles).find(
      (key) =>
        !key.startsWith("/overtime") &&
        !key.startsWith("/leave") &&
        !key.startsWith("/shifts") &&
        (pathname === key || pathname.startsWith(`${key}/`)),
    );
    return match ?? "/dashboard";
  }, [pathname]);

  // GSAP: Smooth pop/glow transition when active menu item changes
  useEffect(() => {
    if (siderRef.current) {
      const activeItem = siderRef.current.querySelector(
        ".ant-menu-item-selected"
      );
      if (activeItem) {
        gsap.fromTo(
          activeItem,
          { scale: 0.96, opacity: 0.85 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.3,
            ease: "back.out(1.8)",
            clearProps: "transform,opacity",
          }
        );
      }
    }
  }, [selectedKey]);

  const headerTitle = useMemo(() => {
    if (pathname.startsWith("/employees/")) {
      const id = pathname.split("/")[2];
      return getEmployeeById(id)?.name ?? "Employee";
    }
    if (pathname.startsWith("/leave/requests/")) {
      return "Leave detail";
    }
    if (pathname.startsWith("/overtime/employees/")) {
      const id = pathname.split("/")[3];
      return getEmployeeById(id)?.name
        ? `OT · ${getEmployeeById(id)!.name}`
        : "Employee OT";
    }
    if (pathname.startsWith("/overtime/sites/")) {
      const id = pathname.split("/")[3];
      return getSiteById(id)?.name
        ? `OT · ${getSiteById(id)!.name}`
        : "Site OT";
    }
    return pageTitles[selectedKey] ?? "Dashboard";
  }, [pathname, selectedKey]);

  const navItemsFiltered = useMemo(() => {
    const role = normalizeRole(user?.role);
    if (role === "employee") {
      return [
        { key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
        {
          key: "leave",
          icon: <CalendarOutlined />,
          label: "Leave",
          children: [
            { key: "/leave", label: "Overview" },
            { key: "/leave/requests", label: "My requests" },
          ],
        },
        {
          key: "academy",
          icon: <BookOutlined />,
          label: "Academy",
          children: [
            { key: "/training", icon: <ReadOutlined />, label: "Training" },
            {
              key: "/certifications",
              icon: <SafetyCertificateOutlined />,
              label: "Certifications",
            },
          ],
        },
        {
          key: "/salary",
          icon: <WalletOutlined />,
          label: "Salary history",
        },
      ] as MenuProps["items"];
    }

    const leaveKids = leaveChildren.filter((c) => {
      if (c.key === "/leave/management") return canViewLeaveManagement(user);
      return true;
    });

    const shiftKeys = visibleShiftNavKeys(user);
    const shiftKids = shiftKeys
      ? shiftChildren.filter((c) => shiftKeys.includes(c.key))
      : [];

    const items: MenuProps["items"] = [
      { key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
      { key: "/employees", icon: <TeamOutlined />, label: "Employees" },
    ];

    if (canViewSitesNav(user)) {
      items.push({
        key: "/sites",
        icon: <EnvironmentOutlined />,
        label: "Sites",
      });
    }

    items.push(
      { key: "/training", icon: <ReadOutlined />, label: "Training" },
      {
        key: "/certifications",
        icon: <SafetyCertificateOutlined />,
        label: "Certifications",
      },
    );

    if (canViewShiftsNav(user) && shiftKids.length) {
      items.push({
        key: "shifts",
        icon: <ScheduleOutlined />,
        label: "Shifts",
        children: shiftKids,
      });
    }

    if (canViewRelieverPoolNav(user)) {
      items.push({
        key: "/reliever-pool",
        icon: <ClusterOutlined />,
        label: "Reliever Pool",
      });
    }

    items.push({
      key: "leave",
      icon: <CalendarOutlined />,
      label: "Leave",
      children: leaveKids,
    });

    if (canViewOtModule(user)) {
      items.push({
        key: "overtime",
        icon: <ClockCircleOutlined />,
        label: "OverTime",
        children: [
          ...overtimeChildren,
          ...(canAssignOt(user)
            ? [{ key: "/overtime/assign", label: "Assign / notify" }]
            : []),
        ],
      });
    }

    return items;
  }, [user]);

  const profileHref = user?.employeeId
    ? `/employees/${user.employeeId}`
    : null;

  const unreadCount = user?.employeeId
    ? getUnreadCount(user.employeeId)
    : 0;

  const userMenu: MenuProps["items"] = [
    ...(profileHref
      ? [
          {
            key: "my-profile",
            icon: <UserOutlined />,
            label: "My Profile",
            onClick: () => router.push(profileHref),
          },
          { type: "divider" as const },
        ]
      : []),
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: "Settings",
      onClick: () => setSettingsOpen(true),
    },
    {
      key: "role",
      label: `Role: ${roleLabel(user?.role)}`,
      disabled: true,
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Log out",
      onClick: () => {
        logout();
        router.replace("/login");
      },
    },
  ];

  if (!ready) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: nectarColors.sand,
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(next) => setCollapsedPersisted(next)}
        breakpoint="lg"
        width={232}
        collapsedWidth={72}
        trigger={null}
        className={`nectar-sider${collapsed ? " nectar-sider-collapsed" : ""}`}
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: collapsed ? "visible" : "auto",
          zIndex: 20,
        }}
      >
        <div ref={siderRef}>
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            padding: collapsed ? "20px 8px" : "20px 20px",
            textDecoration: "none",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            justifyContent: collapsed ? "center" : "flex-start",
            overflow: "hidden",
            height: 68,
          }}
        >
          {collapsed ? (
            <div
              ref={logoShortRef}
              style={{
                color: nectarColors.white,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.05em",
                background: "rgba(28, 68, 99, 0.4)",
                width: 36,
                height: 36,
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              NE
            </div>
          ) : (
            <div ref={logoFullRef} style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                  color: nectarColors.white,
                  fontSize: 16,
                  lineHeight: 1.2,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                Nectar Enviro
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 11,
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                }}
              >
                Ops Console
              </div>
            </div>
          )}
        </Link>

        <Menu
          theme="dark"
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[selectedKey]}
          openKeys={openKeys}
          onOpenChange={(keys) => {
            if (collapsed) {
              // One flyout at a time while collapsed
              const latest = keys.filter((k) => !openKeys.includes(k));
              setOpenKeys(latest.length ? [latest[latest.length - 1]] : keys.slice(-1));
              return;
            }
            setOpenKeys(keys);
          }}
          triggerSubMenuAction="hover"
          tooltip={{ placement: "right" }}
          items={navItemsFiltered}
          classNames={{
            popup: {
              root: "nectar-sider-flyout",
            },
          }}
          popupRender={(node, info) => {
            const path = info.keys ?? [];
            const key = String(path[path.length - 1] ?? path[0] ?? "");
            const title =
              FLYOUT_TITLES[key] ??
              submenuTitleText(
                (info.item as { label?: unknown } | undefined)?.label,
              );
            return (
              <GsapFlyoutCard title={title}>
                {node as ReactElement}
              </GsapFlyoutCard>
            );
          }}
          onClick={({ key }) => {
            if (
              key === "overtime" ||
              key === "leave" ||
              key === "shifts" ||
              key === "academy"
            ) {
              return;
            }
            router.push(key);
            if (collapsed) setOpenKeys([]);
          }}
          style={{ marginTop: 8, borderInlineEnd: "none" }}
        />
        </div>
      </Sider>

      <Layout>
        <Header
          style={{
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            background: nectarColors.white,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              ref={toggleBtnRef}
              type="button"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={handleToggleCollapse}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 18,
                color: nectarColors.ink,
                display: "grid",
                placeItems: "center",
                padding: 4,
              }}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </button>
            <Typography.Title
              level={4}
              style={{
                margin: 0,
                fontFamily: "var(--font-fraunces), Georgia, serif",
                color: nectarColors.ink,
              }}
            >
              {headerTitle}
            </Typography.Title>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {user?.employeeId ? (
              <button
                type="button"
                aria-label="Notifications"
                onClick={() => router.push("/notifications")}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  padding: 6,
                  color: nectarColors.ink,
                  fontSize: 18,
                  borderRadius: 8,
                }}
              >
                <Badge count={unreadCount} size="small" offset={[-2, 2]}>
                  <BellOutlined style={{ fontSize: 18, color: nectarColors.ink }} />
                </Badge>
              </button>
            ) : null}
            <Dropdown menu={{ items: userMenu }} placement="bottomRight">
              <button
                type="button"
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "4px 0",
                }}
              >
                <Avatar
                  size="small"
                  icon={<UserOutlined />}
                  style={{ background: nectarColors.leaf }}
                />
                <span style={{ color: nectarColors.ink, fontSize: 14 }}>
                  {user?.name}
                </span>
              </button>
            </Dropdown>
          </div>
        </Header>

        <Content style={{ padding: 24, minHeight: 280 }}>{children}</Content>
      </Layout>

      <Modal
        title="Settings"
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        okText="Reset demo data"
        okButtonProps={{ danger: true }}
        onOk={() => {
          resetDemoLocalData();
          setSettingsOpen(false);
          window.location.reload();
        }}
      >
        <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>
          Clear leave, shift, reliever, OT assign, notification, and training
          edits saved in this browser. Built-in demo records come back. Your
          login stays signed in.
        </p>
      </Modal>
    </Layout>
  );
}
