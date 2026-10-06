"use client";

import { Select, Typography } from "antd";
import { GlobalOutlined } from "@ant-design/icons";
import { LOCALES, LOCALE_META, type Locale } from "./types";
import { useI18n } from "./I18nProvider";

type Props = {
  /** compact = header control; full = settings / login */
  variant?: "compact" | "full";
  className?: string;
  style?: React.CSSProperties;
};

export default function LanguageSwitcher({
  variant = "compact",
  className,
  style,
}: Props) {
  const { locale, setLocale, t } = useI18n();

  const options = LOCALES.map((code) => ({
    value: code,
    label:
      variant === "full"
        ? `${LOCALE_META[code].nativeLabel} (${t(`lang.${code}`)})`
        : LOCALE_META[code].nativeLabel,
  }));

  if (variant === "full") {
    return (
      <div className={className} style={style}>
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 6, fontSize: 12 }}>
          {t("lang.choose")}
        </Typography.Text>
        <Select<Locale>
          value={locale}
          onChange={setLocale}
          options={options}
          style={{ width: "100%" }}
          suffixIcon={<GlobalOutlined />}
          aria-label={t("app.language")}
        />
      </div>
    );
  }

  return (
    <Select<Locale>
      className={className}
      value={locale}
      onChange={setLocale}
      options={options}
      variant="borderless"
      popupMatchSelectWidth={false}
      suffixIcon={<GlobalOutlined style={{ fontSize: 12 }} />}
      style={{ minWidth: 96, ...style }}
      aria-label={t("app.language")}
      styles={{
        root: { fontWeight: 600, fontSize: 12 },
      }}
    />
  );
}
