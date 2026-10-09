"use client";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, App } from "antd";
import enUS from "antd/locale/en_US";
import hiIN from "antd/locale/hi_IN";
import mrIN from "antd/locale/mr_IN";
import { nectarTheme } from "@/lib/theme";
import { I18nProvider, useI18n } from "@/lib/i18n";

const ANT_LOCALES = {
  en: enUS,
  hi: hiIN,
  mr: mrIN,
} as const;

function AntdLocaleShell({ children }: { children: React.ReactNode }) {
  const { locale } = useI18n();
  const isIndic = locale === "hi" || locale === "mr";

  return (
    <ConfigProvider
      theme={{
        ...nectarTheme,
        token: {
          ...nectarTheme.token,
          fontFamily: isIndic
            ? "var(--font-noto-devanagari), var(--font-dm-sans), system-ui, sans-serif"
            : nectarTheme.token?.fontFamily,
        },
      }}
      locale={ANT_LOCALES[locale]}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry>
      <I18nProvider>
        <AntdLocaleShell>{children}</AntdLocaleShell>
      </I18nProvider>
    </AntdRegistry>
  );
}
