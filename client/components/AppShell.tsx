"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
} from "@ant-design/icons";
import { getSession, logout, type SessionUser } from "@/lib/auth";
import { getEmployeeById, getSiteById } from "@/lib/mock-data";
import {
  canViewLeaveManagement,
  canViewLeavePending,
  canViewOtModule,
  normalizeRole,
  roleLabel,
} from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";

const { Header, Sider, Content } = Layout;

const overtimeChildren = [
  { key: "/overtime/overview", label: "Overview" },
  { key: "/overtime/employees", label: "Employees" },
  { key: "/overtime/sites", label: "Sites" },
  { key: "/overtime/analysis", label: "Analysis" },
  { key: "/overtime/reports", label: "Reports" },
];

const leaveChildren = [
  { key: "/leave", label: "Overview" },
  { key: "/leave/requests", label: "Requests" },
  { key: "/leave/pending", label: "Pending justifications" },
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
  "/leave/pending": "Pending Justifications",
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
  "/overtime/analysis": "OT Analysis",
  "/overtime/reports": "OT Reports",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setUser(session);
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (pathname.startsWith("/overtime")) {
      setOpenKeys((keys) =>
        keys.includes("overtime") ? keys : [...keys, "overtime"],
      );
    }
    if (pathname.startsWith("/leave")) {
      setOpenKeys((keys) =>
        keys.includes("leave") ? keys : [...keys, "leave"],
      );
    }
    if (pathname.startsWith("/shifts")) {
      setOpenKeys((keys) =>
        keys.includes("shifts") ? keys : [...keys, "shifts"],
      );
    }
  }, [pathname]);

  const selectedKey = useMemo(() => {
    if (pathname.startsWith("/leave/requests/")) {
      return "/leave/requests";
    }
    if (pathname.startsWith("/leave/")) {
      const match = leaveChildren.find(
        (c) => pathname === c.key || pathname.startsWith(`${c.key}/`),
      );
      return match?.key ?? "/leave";
    }
    if (pathname === "/leave") return "/leave";
    if (pathname.startsWith("/shifts/")) {
      const match = shiftChildren.find(
        (c) => pathname === c.key || pathname.startsWith(`${c.key}/`),
      );
      return match?.key ?? "/shifts";
    }
    if (pathname === "/shifts") return "/shifts";
    if (pathname.startsWith("/overtime/employees/")) {
      return "/overtime/employees";
    }
    if (pathname.startsWith("/overtime/sites/")) {
      return "/overtime/sites";
    }
    if (pathname.startsWith("/overtime/")) {
      const match = overtimeChildren.find(
        (c) => pathname === c.key || pathname.startsWith(`${c.key}/`),
      );
      return match?.key ?? "/overtime/overview";
    }
    const match = Object.keys(pageTitles).find(
      (key) =>
        !key.startsWith("/overtime") &&
        !key.startsWith("/leave") &&
        !key.startsWith("/shifts") &&
        (pathname === key || pathname.startsWith(`${key}/`)),
    );
    return match ?? "/dashboard";
  }, [pathname]);

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
      const empId = user?.employeeId ?? "e1";
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
      ] as MenuProps["items"];
    }

    const leaveKids = leaveChildren.filter((c) => {
      if (c.key === "/leave/pending") return canViewLeavePending(user);
      if (c.key === "/leave/management") return canViewLeaveManagement(user);
      return true;
    });

    const items: MenuProps["items"] = [
      { key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
      { key: "/employees", icon: <TeamOutlined />, label: "Employees" },
      { key: "/sites", icon: <EnvironmentOutlined />, label: "Sites" },
      { key: "/training", icon: <ReadOutlined />, label: "Training" },
      {
        key: "shifts",
        icon: <ScheduleOutlined />,
        label: "Shifts",
        children: shiftChildren,
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
        children: overtimeChildren,
      });
    }

    // Safety / HR / elevated keep full ops nav; employee branch handled above
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
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        width={232}
        trigger={null}
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "auto",
        }}
      >
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: collapsed ? "20px 12px" : "20px 20px",
            textDecoration: "none",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `linear-gradient(145deg, ${nectarColors.mint}, ${nectarColors.leaf})`,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3c4 3 7 7 7 11a7 7 0 1 1-14 0c0-4 3-8 7-11Z"
                fill="white"
                opacity="0.95"
              />
            </svg>
          </span>
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-fraunces), Georgia, serif",
                  color: nectarColors.white,
                  fontSize: 16,
                  lineHeight: 1.2,
                  fontWeight: 600,
                }}
              >
                Nectar Enviro
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 11,
                  letterSpacing: "0.02em",
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
          selectedKeys={[selectedKey]}
          openKeys={collapsed ? [] : openKeys}
          onOpenChange={setOpenKeys}
          triggerSubMenuAction="hover"
          items={navItemsFiltered}
          onClick={({ key }) => {
            if (key === "overtime" || key === "leave" || key === "shifts") return;
            router.push(key);
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
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: nectarColors.white,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed((c) => !c)}
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
