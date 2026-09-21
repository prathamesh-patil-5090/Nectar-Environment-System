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
} from "@ant-design/icons";
import { getSession, logout, type SessionUser } from "@/lib/auth";
import { nectarColors } from "@/lib/theme";

const { Header, Sider, Content } = Layout;

const navItems: MenuProps["items"] = [
  { key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
  { key: "/employees", icon: <TeamOutlined />, label: "Employees" },
  { key: "/sites", icon: <EnvironmentOutlined />, label: "Sites" },
  { key: "/training", icon: <ReadOutlined />, label: "Training" },
];

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/employees": "Employees",
  "/sites": "Sites",
  "/training": "Training",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setUser(session);
    setReady(true);
  }, [router]);

  const selectedKey = useMemo(() => {
    const match = Object.keys(pageTitles).find(
      (key) => pathname === key || pathname.startsWith(`${key}/`),
    );
    return match ?? "/dashboard";
  }, [pathname]);

  const userMenu: MenuProps["items"] = [
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
          items={navItems}
          onClick={({ key }) => router.push(key)}
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
              {pageTitles[selectedKey] ?? "Dashboard"}
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
