import type { ThemeConfig } from "antd";

export const nectarColors = {
  ink: "#0F2A24",
  leaf: "#1F6B4A",
  mint: "#3FAE7C",
  sand: "#F3F6F4",
  alert: "#C45C26",
  sky: "#2B6CB0",
  white: "#FFFFFF",
  muted: "#5A6F68",
} as const;

export const nectarTheme: ThemeConfig = {
  token: {
    colorPrimary: nectarColors.leaf,
    colorInfo: nectarColors.sky,
    colorSuccess: nectarColors.mint,
    colorWarning: nectarColors.alert,
    colorError: nectarColors.alert,
    colorBgLayout: nectarColors.sand,
    colorBgContainer: nectarColors.white,
    colorText: nectarColors.ink,
    colorTextSecondary: nectarColors.muted,
    borderRadius: 8,
    fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
    controlHeight: 40,
  },
  components: {
    Layout: {
      siderBg: nectarColors.ink,
      triggerBg: "#0A1F1A",
      headerBg: nectarColors.white,
      bodyBg: nectarColors.sand,
    },
    Menu: {
      darkItemBg: nectarColors.ink,
      darkSubMenuItemBg: nectarColors.ink,
      darkItemSelectedBg: nectarColors.leaf,
      darkItemHoverBg: "#163830",
      darkItemColor: "rgba(255,255,255,0.78)",
      darkItemSelectedColor: nectarColors.white,
    },
    Button: {
      primaryShadow: "none",
    },
    Table: {
      headerBg: "#E8F0EC",
    },
  },
};
