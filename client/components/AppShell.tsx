"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from "react";
import gsap from "gsap";
import {
  App,
  Avatar,
  Badge,
  Dropdown,
  Layout,
  Menu,
  Modal,
  Spin,
  Tag,
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
  VideoCameraOutlined,
  MedicineBoxOutlined,
  SettingOutlined,
  SafetyOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { getSession, logout, type SessionUser, type UserRole } from "@/lib/auth";
import { resetDemoLocalData } from "@/lib/demo-reset";
import { getEmployeeById, getSiteById } from "@/lib/mock-data";
import { getUnreadCount } from "@/lib/notifications";
import { getServerNotifications } from "@/lib/api/training";
import { personIdOf } from "@/lib/training/identity";
import {
  canAssignOt,
  canConfirmLeaveReturn,
  canManageRelieverPool,
  canViewLeaveManagement,
  canViewOtModule,
  canViewEmployeeRoster,
  canViewRelieverPoolNav,
  canViewShiftsNav,
  canViewSitesNav,
  normalizeRole,
  roleLabel,
  visibleShiftNavKeys,
} from "@/lib/rbac";
import { nectarColors } from "@/lib/theme";
import { hydrateAllStoresFromApi } from "@/lib/sync";
import { ackSafetyEmergency, getActiveEmergencies } from "@/lib/api/safety";
import type { SafetyEvent } from "@/lib/safety/types";
import { safetyActorOf } from "@/lib/rbac";
import { LanguageSwitcher, translatePersonName, useI18n } from "@/lib/i18n";

const { Header, Sider, Content } = Layout;

const SIDER_COLLAPSED_KEY = "nectar-enviro-sider-collapsed";

type TFn = (key: string) => string;

/** HR / Manager / Director see Training, Events + Certifications as records; everyone else as Academy. */
function academyNavGroup(role: UserRole, t: TFn): NonNullable<MenuProps["items"]>[number] {
  const isRecords = role === "hr" || role === "manager" || role === "director";
  return {
    key: isRecords ? "academic-records" : "academy",
    icon: <BookOutlined />,
    label: isRecords ? t("nav.academicRecords") : t("nav.academy"),
    children: [
      { key: "/training", icon: <ReadOutlined />, label: t("nav.training") },
      { key: "/training/events", icon: <CalendarOutlined />, label: t("nav.events") },
      { key: "/training/mentors", icon: <TeamOutlined />, label: t("nav.mentors") },
      { key: "/certifications", icon: <SafetyCertificateOutlined />, label: t("nav.certifications") },
    ],
  };
}

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

function submenuTitleText(label: unknown, fallback = "Menu"): string {
  if (typeof label === "string") return label;
  return fallback;
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
        { opacity: 1, x: 0, scale: 1, duration: 0.28, ease: "power3.out" }
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

const PAGE_TITLE_KEYS = [
  "/dashboard",
  "/employees",
  "/sites",
  "/training",
  "/reliever-pool",
  "/reliever-pool/competition",
  "/leave",
  "/leave/requests",
  "/leave/lifecycle",
  "/leave/management",
  "/shifts",
  "/shifts/master",
  "/shifts/schedule",
  "/shifts/rotation",
  "/shifts/change-requests",
  "/shifts/reliever-allocation",
  "/shifts/manpower",
  "/shifts/deviations",
  "/overtime/overview",
  "/overtime/employees",
  "/overtime/sites",
  "/overtime/analysis",
  "/overtime/decisions",
  "/overtime/assign",
  "/notifications",
  "/certifications",
  "/salary",
  "/meetings",
  "/safety",
  "/safety/report",
  "/safety/incidents",
  "/safety/breakdowns",
  "/safety/protocols",
  "/safety/training",
] as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { t, pageTitle, locale } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const siderRef = useRef<HTMLDivElement>(null);
  const logoFullRef = useRef<HTMLDivElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);

  const setCollapsedPersisted = (next: boolean) => {
    setCollapsed(next);
    writeSiderCollapsed(next);
    if (next) setOpenKeys([]);
  };

  // Restore before paint so a hard refresh keeps the last collapse choice
  useLayoutEffect(() => {
    setCollapsed(readSiderCollapsed() || window.innerWidth < 768); // narrow screens start collapsed (not persisted)
  }, []);

  // GSAP: Fade the logo back in on expand (collapsed shows no logo, only the toggle)
  useEffect(() => {
    if (!collapsed && logoFullRef.current) {
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
          { opacity: 1, x: 0, duration: 0.32, stagger: 0.02, ease: "power2.out", clearProps: "transform,opacity" }
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
          { opacity: 1, y: 0, duration: 0.28, stagger: 0.035, ease: "power2.out", clearProps: "transform,opacity" }
        );
      }
    }
  }, [openKeys, collapsed]);

  // Global live API hydration from MongoDB Atlas
  useEffect(() => {
    hydrateAllStoresFromApi().catch(() => {});
  }, []);

  // Server notifications (training events, flags, certificates): poll the unread count
  // Safety emergencies: pinned banner until this person acknowledges
  const [emergencies, setEmergencies] = useState<SafetyEvent[]>([]);
  useEffect(() => {
    const personId = personIdOf(user);
    if (!personId) return;
    const load = () =>
      getActiveEmergencies(personId)
        .then(setEmergencies)
        .catch(() => {});
    void load();
    const t = setInterval(load, 30_000);
    window.addEventListener("safety-emergencies-changed", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("safety-emergencies-changed", load);
    };
  }, [user, pathname]);

  const acknowledgeEmergency = async (id: string) => {
    const actor = safetyActorOf(user);
    if (!actor) return;
    try {
      await ackSafetyEmergency(id, actor);
      setEmergencies((rows) => rows.filter((e) => e.id !== id));
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Could not acknowledge");
    }
  };

  const [serverUnread, setServerUnread] = useState(0);
  useEffect(() => {
    const personId = personIdOf(user);
    if (!personId) return;
    const load = () =>
      getServerNotifications(personId)
        .then((rows) => setServerUnread(rows.filter((n) => !n.read).length))
        .catch(() => {});
    void load();
    const t = setInterval(load, 60_000);
    window.addEventListener("server-notifications-changed", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("server-notifications-changed", load);
    };
  }, [user, pathname]);

  // GSAP: Smooth magnetic hover on sidebar menu items
  useEffect(() => {
    const siderEl = siderRef.current;
    if (!siderEl) return;

    const handleMouseEnter = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest<HTMLElement>(
        ".ant-menu-item, .ant-menu-submenu-title"
      );
      if (target && !target.classList.contains("ant-menu-item-selected")) {
        gsap.to(target, { x: 4, duration: 0.22, ease: "power2.out" });
      }
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest<HTMLElement>(
        ".ant-menu-item, .ant-menu-submenu-title"
      );
      if (target) {
        gsap.to(target, { x: 0, duration: 0.25, ease: "power2.out" });
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
      setReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, [router]);

  useEffect(() => {
    if (collapsed) return;
    const extras: string[] = [];
    if (pathname.startsWith("/leave")) extras.push("leave");
    if (pathname.startsWith("/overtime")) extras.push("overtime");
    if (pathname.startsWith("/reliever-pool")) extras.push("reliever-pool");
    if (pathname.startsWith("/safety")) extras.push("safety");
    if (pathname.startsWith("/shifts") && canViewShiftsNav(user)) {
      extras.push("shifts");
    }
    if (pathname.startsWith("/training") || pathname.startsWith("/certifications")) {
      const group = academyNavGroup(normalizeRole(user?.role), t);
      if (group?.key) extras.push(String(group.key));
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
  }, [pathname, collapsed, user, t]);

  const shiftChildren = useMemo(
    () => [
      { key: "/shifts", label: t("nav.shiftsDashboard") },
      { key: "/shifts/master", label: t("nav.shiftMaster") },
      { key: "/shifts/schedule", label: t("nav.schedule") },
      { key: "/shifts/rotation", label: t("nav.rotation") },
      { key: "/shifts/change-requests", label: t("nav.changeRequests") },
      { key: "/shifts/reliever-allocation", label: t("nav.relieverAllocation") },
      { key: "/shifts/manpower", label: t("nav.manpowerConflict") },
      { key: "/shifts/deviations", label: t("nav.deviations") },
    ],
    [t],
  );

  const safetyChildren = useMemo(
    () => [
      { key: "/safety", label: t("nav.safetyOverview") },
      { key: "/safety/report", label: t("nav.safetyReport") },
      { key: "/safety/incidents", label: t("nav.safetyIncidents") },
      { key: "/safety/breakdowns", label: t("nav.safetyBreakdowns") },
      { key: "/safety/protocols", label: t("nav.safetyProtocols") },
    ],
    [t],
  );

  const leaveChildren = useMemo(
    () => [
      { key: "/leave", label: t("nav.leaveOverview") },
      { key: "/leave/requests", label: t("nav.leaveRequests") },
      { key: "/leave/lifecycle", label: t("nav.leaveLifecycle") },
      { key: "/leave/management", label: t("nav.leaveManagement") },
    ],
    [t],
  );

  const overtimeChildren = useMemo(
    () => [
      { key: "/overtime/overview", label: t("nav.otOverview") },
      { key: "/overtime/employees", label: t("nav.otEmployees") },
      { key: "/overtime/sites", label: t("nav.otSites") },
      { key: "/overtime/analysis", label: t("nav.otAnalysis") },
      { key: "/overtime/decisions", label: t("nav.otDecisions") },
    ],
    [t],
  );

  const safetyNavItem = useMemo(
    (): NonNullable<MenuProps["items"]>[number] => ({
      key: "safety",
      icon: <SafetyOutlined />,
      label: t("nav.safety"),
      children: safetyChildren,
    }),
    [t, safetyChildren],
  );

  const meetingsNavItem = useMemo(
    (): NonNullable<MenuProps["items"]>[number] => ({
      key: "/meetings",
      icon: <VideoCameraOutlined />,
      label: (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {t("nav.meetings")}
          <Tag color="green" style={{ marginInlineEnd: 0, fontSize: 10, lineHeight: "16px" }}>
            {t("app.soon")}
          </Tag>
        </span>
      ),
    }),
    [t],
  );

  const medicalRecordsNavItem = useMemo(
    (): NonNullable<MenuProps["items"]>[number] => ({
      key: "/medical-records",
      icon: <MedicineBoxOutlined />,
      label: (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {t("nav.medicalRecords")}
          <Tag color="green" style={{ marginInlineEnd: 0, fontSize: 10, lineHeight: "16px" }}>
            {t("app.soon")}
          </Tag>
        </span>
      ),
    }),
    [t],
  );

  const flyoutTitles = useMemo(
    (): Record<string, string> => ({
      leave: t("nav.leave"),
      shifts: t("nav.shifts"),
      overtime: t("nav.overtime"),
      academy: t("nav.academy"),
      "academic-records": t("nav.academicRecords"),
      "reliever-pool": t("nav.relieverPool"),
      safety: t("nav.safety"),
    }),
    [t],
  );

  const selectedKey = useMemo(() => {
    // 1. Leave routes
    if (pathname.startsWith("/leave/requests") || pathname.startsWith("/leave/pending")) {
      return "/leave/requests";
    }
    if (pathname.startsWith("/leave/lifecycle")) {
      return "/leave/lifecycle";
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

    // 2b. Reliever pool
    if (pathname.startsWith("/reliever-pool/competition")) {
      return "/reliever-pool/competition";
    }
    if (pathname === "/reliever-pool" || pathname.startsWith("/reliever-pool")) {
      return "/reliever-pool";
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
    if (pathname.startsWith("/overtime/decisions")) {
      return "/overtime/decisions";
    }
    if (pathname.startsWith("/overtime/assign")) {
      return "/overtime/assign";
    }
    if (pathname.startsWith("/overtime/overview") || pathname === "/overtime") {
      return "/overtime/overview";
    }

    // 3b. Safety (detail pages map to their list)
    if (pathname.startsWith("/safety/incidents")) return "/safety/incidents";
    if (pathname.startsWith("/safety/breakdowns")) return "/safety/breakdowns";
    if (pathname.startsWith("/safety/")) {
      const match = safetyChildren.find((c) => c.key !== "/safety" && pathname.startsWith(c.key));
      if (match) return match.key;
    }
    if (pathname === "/safety") return "/safety";

    // 4. Employee directory vs own profile (own profile is navbar-only)
    if (pathname === "/employees" || pathname.startsWith("/employees/")) {
      return "/employees";
    }

    // 5. Training events + communities have their own sidebar entry
    if (pathname.startsWith("/training/events") || pathname.startsWith("/training/communities")) {
      return "/training/events";
    }
    if (pathname.startsWith("/training/mentors")) return "/training/mentors";

    // 6. Direct match from known page keys
    const match = PAGE_TITLE_KEYS.find(
      (key) =>
        !key.startsWith("/overtime") &&
        !key.startsWith("/leave") &&
        !key.startsWith("/shifts") &&
        (pathname === key || pathname.startsWith(`${key}/`)),
    );
    return match ?? "/dashboard";
  }, [pathname, shiftChildren, safetyChildren]);

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
          { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.8)", clearProps: "transform,opacity" }
        );
      }
    }
  }, [selectedKey]);

  const headerTitle = useMemo(() => {
    if (pathname.startsWith("/employees/")) {
      const id = pathname.split("/")[2];
      return getEmployeeById(id)?.name ?? t("common.employee");
    }
    if (pathname.startsWith("/leave/requests/")) {
      return t("pages./leave/requests");
    }
    if (pathname.startsWith("/safety/incidents/")) return t("pages./safety/incidents");
    if (pathname.startsWith("/safety/breakdowns/")) return t("pages./safety/breakdowns");
    if (pathname.startsWith("/training/")) {
      return t("nav.training");
    }
    if (pathname.startsWith("/reliever-pool/competition")) {
      return t("pages./reliever-pool/competition");
    }
    if (pathname.startsWith("/overtime/employees/")) {
      const id = pathname.split("/")[3];
      const name = getEmployeeById(id)?.name;
      return name ? `OT · ${name}` : t("pages./overtime/employees");
    }
    if (pathname.startsWith("/overtime/sites/")) {
      const id = pathname.split("/")[3];
      const name = getSiteById(id)?.name;
      return name ? `OT · ${name}` : t("pages./overtime/sites");
    }
    return pageTitle(selectedKey);
  }, [pathname, selectedKey, t, pageTitle]);

  const navItemsFiltered = useMemo(() => {
    const role = normalizeRole(user?.role);
    if (role === "employee") {
      return [
        { key: "/dashboard", icon: <DashboardOutlined />, label: t("nav.dashboard") },
        {
          key: "leave",
          icon: <CalendarOutlined />,
          label: t("nav.leave"),
          children: [
            { key: "/leave", label: t("nav.leaveOverview") },
            { key: "/leave/requests", label: t("nav.leaveRequests") },
          ],
        },
        academyNavGroup(role, t),
        safetyNavItem,
        { key: "/salary", icon: <WalletOutlined />, label: t("nav.salary") },
        meetingsNavItem,
        medicalRecordsNavItem,
      ] as MenuProps["items"];
    }

    const leaveKids = leaveChildren.filter((c) => {
      if (c.key === "/leave/management") return canViewLeaveManagement(user);
      if (c.key === "/leave/lifecycle") {
        return (
          canViewLeaveManagement(user) ||
          canConfirmLeaveReturn(user) ||
          canManageRelieverPool(user)
        );
      }
      return true;
    });

    const shiftKeys = visibleShiftNavKeys(user);
    const shiftKids = shiftKeys
      ? shiftChildren.filter((c) => shiftKeys.includes(c.key))
      : [];

    const items: MenuProps["items"] = [
      { key: "/dashboard", icon: <DashboardOutlined />, label: t("nav.dashboard") },
      ...(canViewEmployeeRoster(user)
        ? [{ key: "/employees", icon: <TeamOutlined />, label: t("nav.employees") }]
        : []),
    ];

    if (canViewSitesNav(user)) {
      items.push({ key: "/sites", icon: <EnvironmentOutlined />, label: t("nav.sites") });
    }

    items.push(academyNavGroup(role, t));

    if (canViewShiftsNav(user) && shiftKids.length) {
      items.push({ key: "shifts", icon: <ScheduleOutlined />, label: t("nav.shifts"), children: shiftKids });
    }

    if (canViewRelieverPoolNav(user)) {
      items.push({
        key: "reliever-pool",
        icon: <ClusterOutlined />,
        label: t("nav.relieverPool"),
        children: [
          { key: "/reliever-pool", label: t("nav.relieverPool") },
          { key: "/reliever-pool/competition", label: t("nav.competition") },
        ],
      });
    }

    items.push({ key: "leave", icon: <CalendarOutlined />, label: t("nav.leave"), children: leaveKids });

    if (canViewOtModule(user)) {
      items.push({
        key: "overtime",
        icon: <ClockCircleOutlined />,
        label: t("nav.overtime"),
        children: [
          ...overtimeChildren,
          ...(canAssignOt(user)
            ? [{ key: "/overtime/assign", label: t("pages./overtime/assign") }]
            : []),
        ],
      });
    }

    items.push(safetyNavItem);
    items.push(meetingsNavItem);
    items.push(medicalRecordsNavItem);

    return items;
  }, [
    user,
    t,
    leaveChildren,
    shiftChildren,
    overtimeChildren,
    safetyNavItem,
    meetingsNavItem,
    medicalRecordsNavItem,
    locale,
  ]);

  const profileHref = user?.employeeId
    ? `/employees/${user.employeeId}`
    : null;

  const unreadCount = (user?.employeeId ? getUnreadCount(user.employeeId) : 0) + serverUnread;

  const userMenu: MenuProps["items"] = [
    ...(profileHref
      ? [
          { key: "my-profile", icon: <UserOutlined />, label: t("nav.myProfile"), onClick: () => router.push(profileHref) },
          { type: "divider" as const },
        ]
      : []),
    { key: "settings", icon: <SettingOutlined />, label: t("app.settings"), onClick: () => setSettingsOpen(true) },
    { key: "role", label: `${t("common.role")}: ${roleLabel(user?.role)}`, disabled: true },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: t("app.logout"),
      onClick: () => {
        logout();
        router.replace("/login");
      },
    },
  ];

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: nectarColors.sand }}><Spin size="large" /></div>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(next, type) => {
          // Only persist user toggles — ignore Ant Design responsive auto-collapse
          if (type === "responsive") return;
          setCollapsedPersisted(next);
        }}
        width={232}
        collapsedWidth={72}
        trigger={null}
        className={`nectar-sider${collapsed ? " nectar-sider-collapsed" : ""}`}
        style={{ position: "sticky", top: 0, height: "100vh", overflow: collapsed ? "visible" : "auto", zIndex: 20 }}
      >
        <div ref={siderRef}>
        <div
          style={{
            display: "flex", flexDirection: collapsed ? "column" : "row", alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between", gap: collapsed ? 6 : 8,
            padding: collapsed ? "0 8px" : "0 12px 0 20px", minHeight: 68,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
        {collapsed ? null : (
        <Link
          href="/dashboard"
          style={{
            display: "flex", alignItems: "center", textDecoration: "none",
            justifyContent: collapsed ? "center" : "flex-start", overflow: "hidden", minWidth: 0,
          }}
        >
            <div ref={logoFullRef} style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-dm-sans), system-ui, sans-serif", color: nectarColors.white, fontSize: 16,
                lineHeight: 1.2, fontWeight: 600, whiteSpace: "nowrap",
              }}
            >
              {t("app.name")}
            </div>
            <div
              style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, letterSpacing: "0.02em", whiteSpace: "nowrap" }}
            >
              {t("app.tagline")}
            </div>
          </div>
        </Link>
        )}
          <button
            ref={toggleBtnRef}
            type="button"
            className="nectar-sider-toggle"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={handleToggleCollapse}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
        </div>

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
          classNames={{ popup: { root: "nectar-sider-flyout" } }}
          popupRender={(node, info) => {
            const path = info.keys ?? [];
            const key = String(path[path.length - 1] ?? path[0] ?? "");
            const title =
              flyoutTitles[key] ??
              submenuTitleText(
                (info.item as { label?: unknown } | undefined)?.label,
                t("app.menu"),
              );
            return (
              <GsapFlyoutCard title={title}>{node as ReactElement}</GsapFlyoutCard>
            );
          }}
          onClick={({ key }) => {
            if (
              key === "overtime" ||
              key === "leave" ||
              key === "shifts" ||
              key === "reliever-pool" ||
              key === "academy" ||
              key === "academic-records"
            ) {
              return;
            }
            if (key === "/meetings") {
              message.info("Meetings — coming soon. This feature is under development.");
              return;
            }
            if (key === "/medical-records") {
              message.info("Medical records — coming soon. This feature is under development.");
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
            padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: `1px solid ${token.colorBorderSecondary}`, background: nectarColors.white,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Typography.Title
              level={4}
              style={{ margin: 0, fontFamily: "var(--font-fraunces), Georgia, serif", color: nectarColors.ink }}
            >
              {headerTitle}
            </Typography.Title>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <LanguageSwitcher variant="compact" />
            {user?.employeeId ? (
              <button
                type="button"
                aria-label={t("nav.notifications")}
                onClick={() => router.push("/notifications")}
                style={{
                  border: "none", background: "transparent", cursor: "pointer", display: "grid", placeItems: "center",
                  padding: 6, color: nectarColors.ink, fontSize: 18, borderRadius: 8,
                }}
              >
                <Badge count={unreadCount} size="small" offset={[-2, 2]}><BellOutlined style={{ fontSize: 18, color: nectarColors.ink }} /></Badge>
              </button>
            ) : null}
            <Dropdown menu={{ items: userMenu }} placement="bottomRight">
              <button
                type="button"
                style={{
                  border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center",
                  gap: 10, padding: "4px 0",
                }}
              >
                <Avatar size="small" icon={<UserOutlined />} style={{ background: nectarColors.leaf }} />
                <span style={{ color: nectarColors.ink, fontSize: 14 }}>
                  {translatePersonName(user?.name)}
                </span>
              </button>
            </Dropdown>
          </div>
        </Header>

        <Content style={{ padding: 24, minHeight: 280 }}>
          {emergencies.map((e) => (
            <div
              key={e.id}
              role="alert"
              style={{
                display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between",
                background: "#FDECEA", border: "1px solid #F5A39B", color: "#8A1C12", borderRadius: 10,
                padding: "12px 16px", marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                <WarningOutlined style={{ fontSize: 20 }} />
                <div style={{ minWidth: 0 }}>
                  <strong>EMERGENCY: {e.title}</strong>
                  <div style={{ fontSize: 12 }}>{e.location ? `${e.location} · ` : ""}reported by {e.reportedBy.name} · {new Date(e.reportedAt).toLocaleTimeString("en-IN", { timeStyle: "short" })}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href={`/safety/incidents/${e.id}`}>{t("common.view")}</Link>
                <button
                  type="button"
                  onClick={() => void acknowledgeEmergency(e.id)}
                  style={{ background: "#C62828", color: "#fff", border: 0, borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontWeight: 600 }}
                >
                  {t("common.acknowledge")}
                </button>
              </div>
            </div>
          ))}
          {children}
        </Content>
      </Layout>

      <Modal
        title={t("settings.title")}
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        okText={t("settings.resetDemo")}
        okButtonProps={{ danger: true }}
        cancelText={t("common.cancel")}
        onOk={() => {
          resetDemoLocalData();
          setSettingsOpen(false);
          window.location.reload();
        }}
      >
        <LanguageSwitcher variant="full" style={{ marginBottom: 16 }} />
        <p style={{ margin: "0 0 8px", color: nectarColors.muted, fontSize: 13 }}>
          {t("settings.languageHint")}
        </p>
        <p style={{ margin: 0, color: nectarColors.muted, fontSize: 14 }}>
          {t("settings.resetDemoHint")}
        </p>
      </Modal>
    </Layout>
  );
}
