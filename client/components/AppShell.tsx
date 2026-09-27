"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import gsap from "gsap";
import {
  Avatar,
  Dropdown,
  Layout,
  Menu,
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
} from "@ant-design/icons";
import { getSession, logout, type SessionUser } from "@/lib/auth";
import { getEmployeeById, getSiteById } from "@/lib/mock-data";
import {
  canAssignOt,
  canViewLeaveManagement,
  canViewOtModule,
  hasDualDashboard,
  normalizeRole,
  roleLabel,
} from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";

const { Header, Sider, Content } = Layout;

const FLYOUT_TITLES: Record<string, string> = {
  leave: "Leave",
  shifts: "Shifts",
  overtime: "OverTime",
  "my-employee": "My Profile",
};

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
  "my-salary": "Salary history",
  "my-notifications": "Notifications",
  "my-leave": "My leave",
  "my-training": "Training",
  "my-certifications": "Certifications",
};

const MY_EMPLOYEE_ROUTES: Record<string, string> = {
  "my-leave": "/leave/requests?mine=1",
  "my-salary": "/salary",
  "my-certifications": "/certifications?mine=1",
  "my-training": "/training?mine=1",
  "my-notifications": "/notifications",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMine = searchParams?.get("mine") === "1";
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  const siderRef = useRef<HTMLDivElement>(null);
  const logoFullRef = useRef<HTMLDivElement>(null);
  const logoShortRef = useRef<HTMLDivElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);

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
    setCollapsed((c) => {
      const next = !c;
      if (next) setOpenKeys([]);
      return next;
    });
  };

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    const id = requestAnimationFrame(() => {
      setUser(session);
      setReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, [router]);

  useEffect(() => {
    if (collapsed) return;
    const extras: string[] = [];
    if (hasDualDashboard(user) && isMine && pathname.startsWith("/leave")) {
      extras.push("my-employee");
    } else if (pathname.startsWith("/leave")) {
      extras.push("leave");
    }
    if (pathname.startsWith("/overtime")) extras.push("overtime");
    if (hasDualDashboard(user)) {
      if (
        (user?.employeeId && pathname.startsWith(`/employees/${user.employeeId}`)) ||
        pathname.startsWith("/salary") ||
        pathname.startsWith("/notifications") ||
        (isMine && (pathname.startsWith("/training") || pathname.startsWith("/certifications")))
      ) {
        extras.push("my-employee");
      }
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
  }, [pathname, collapsed, user, isMine]);

  const selectedKey = useMemo(() => {
    // 0. Dual dashboard personal routes (e.g. My leave, My salary, etc.)
    if (hasDualDashboard(user)) {
      if (isMine && pathname.startsWith("/leave/requests")) {
        return "my-leave";
      }
      if (isMine && pathname.startsWith("/training")) {
        return "my-training";
      }
      if (isMine && pathname.startsWith("/certifications")) {
        return "my-certifications";
      }
      if (pathname === "/salary" || pathname.startsWith("/salary/")) {
        return "my-salary";
      }
      if (pathname === "/notifications" || pathname.startsWith("/notifications/")) {
        return "my-notifications";
      }
    }

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
    if (pathname === "/shifts" || pathname.startsWith("/shifts/")) {
      return "/shifts";
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

    // 4. Employee Profile (own profile vs directory)
    const empId = user?.employeeId;
    if (empId && (pathname === `/employees/${empId}` || pathname.startsWith(`/employees/${empId}/`))) {
      return `/employees/${empId}`;
    }
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
  }, [pathname, user, isMine]);

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
      const empId = user?.employeeId ?? "e-etp-s1";
      return [
        { key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
        {
          key: `/employees/${empId}`,
          icon: <TeamOutlined />,
          label: "My profile",
        },
        {
          key: "leave",
          icon: <CalendarOutlined />,
          label: "Leave",
          children: [
            { key: "/leave", label: "Overview" },
            { key: "/leave/requests", label: "My requests" },
          ],
        },
        { key: "/training", icon: <ReadOutlined />, label: "Training" },
        {
          key: "/certifications",
          icon: <SafetyCertificateOutlined />,
          label: "Certifications",
        },
        {
          key: "/salary",
          icon: <WalletOutlined />,
          label: "Salary history",
        },
        {
          key: "/notifications",
          icon: <BellOutlined />,
          label: "Notifications",
        },
      ] as MenuProps["items"];
    }

    const leaveKids = leaveChildren.filter((c) => {
      if (c.key === "/leave/management") return canViewLeaveManagement(user);
      return true;
    });

    const items: MenuProps["items"] = [
      { key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
      { key: "/employees", icon: <TeamOutlined />, label: "Employees" },
      { key: "/sites", icon: <EnvironmentOutlined />, label: "Sites" },
      { key: "/training", icon: <ReadOutlined />, label: "Training" },
      {
        key: "/certifications",
        icon: <SafetyCertificateOutlined />,
        label: "Certifications",
      },
      {
        key: "/shifts",
        icon: <ScheduleOutlined />,
        label: "Shifts",
      },
      {
        key: "/reliever-pool",
        icon: <ClusterOutlined />,
        label: "Reliever Pool",
      },
      {
        key: "leave",
        icon: <CalendarOutlined />,
        label: "Leave",
        children: leaveKids,
      },
    ];

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

    if (hasDualDashboard(user) && user?.employeeId) {
      const empId = user.employeeId;
      items.push({
        type: "divider",
      });
      items.push({
        key: "my-employee",
        icon: <UserOutlined />,
        label: "My Profile",
        children: [
          { key: `/employees/${empId}`, label: "Personal profile" },
          { key: "my-leave", label: "My leave" },
          { key: "my-salary", label: "My salary" },
          { key: "my-certifications", label: "My certifications" },
          { key: "my-training", label: "My training" },
          { key: "my-notifications", label: "Notifications & OT" },
        ],
      });
    }

    return items;
  }, [user]);

  const userMenu: MenuProps["items"] = [
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
        ref={siderRef as any}
        collapsible
        collapsed={collapsed}
        onCollapse={(next) => {
          setCollapsed(next);
          if (next) setOpenKeys([]);
        }}
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
              key === "my-employee"
            ) {
              return;
            }
            const mineHref = MY_EMPLOYEE_ROUTES[key];
            if (mineHref) {
              router.push(mineHref);
              if (collapsed) setOpenKeys([]);
              return;
            }
            router.push(key);
            if (collapsed) setOpenKeys([]);
          }}
          style={{ marginTop: 8, borderInlineEnd: "none" }}
        />
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
        </Header>

        <Content style={{ padding: 24, minHeight: 280 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
