import type { ThemeConfig } from "antd";

export const nectarColors = {
  ink: "#0B1A24",
  leaf: "#1C4463",
  mint: "#1C4463",
  sand: "#F4F7FA",
  alert: "#C45C26",
  sky: "#1C4463",
  white: "#FFFFFF",
  muted: "#4A6375",
} as const;

export const nectarTheme: ThemeConfig = {
  token: {
    colorPrimary: "#1C4463",
    colorInfo: "#1C4463",
    colorSuccess: "#16A34A",
    colorWarning: "#D97706",
    colorError: "#DC2626",
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
      siderBg: "#0B1A24",
      triggerBg: "#060F17",
      headerBg: nectarColors.white,
      bodyBg: nectarColors.sand,
    },
    Menu: {
      darkItemBg: "#0B1A24",
      darkSubMenuItemBg: "#0B1A24",
      darkItemSelectedBg: "#1C4463",
      darkItemHoverBg: "#132D42",
      darkItemColor: "rgba(255,255,255,0.85)",
      darkItemSelectedColor: nectarColors.white,
    },
    Button: {
      primaryShadow: "none",
    },
    Table: {
      headerBg: "#EAF1F6",
    },
  },
};

