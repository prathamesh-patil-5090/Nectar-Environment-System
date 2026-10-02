"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Form, Input, Typography } from "antd";
import { LockOutlined, MailOutlined } from "@ant-design/icons";
import {
  DEMO_CREDENTIALS,
  DEMO_USERS_VISIBLE,
  isAuthenticated,
  login,
  ROLE_LABELS,
} from "@/lib/auth";

import InteractiveEnvironmentalCanvas, {
  type ThemeMode,
} from "@/components/InteractiveEnvironmentalCanvas";
import type { CSSProperties } from "react";

const sText14R10Border: CSSProperties = {
  height: 46,
  borderRadius: 10,
  fontSize: 14,
  backgroundColor: "#F8FAFC",
  border: "1px solid #E2E8F0",
};

const sText13SemiboldColor: CSSProperties = {
  fontWeight: 600,
  fontSize: 13,
  color: "#1C4463",
  letterSpacing: "0.01em",
};

type LoginValues = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const themeMode: ThemeMode = "deep";

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const onFinish = (values: LoginValues) => {
    setLoading(true);
    setError(null);
    const user = login(values.email, values.password);
    if (!user) {
      setError("Invalid email or password. Use the demo credentials below.");
      setLoading(false);
      return;
    }
    router.replace("/dashboard");
  };

  const handleSelectDemoUser = (email: string) => {
    form.setFieldsValue({ email, password: DEMO_CREDENTIALS.password });
    setError(null);
  };

  return (
    <div
      style={{
        minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
        padding: "32px 16px", position: "relative", overflow: "hidden", backgroundColor: "#060f17",
      }}
    >
      {/* Interactive Hydrodynamic Wavefield Canvas */}
      <InteractiveEnvironmentalCanvas themeMode={themeMode} />

      {/* Main Container */}
      <div className="nectar-login-enter" style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 10 }}>
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Typography.Title
            level={1}
            style={{
              margin: 0, fontFamily: "var(--font-dm-sans), system-ui, -apple-system, sans-serif", fontSize: 32,
              color: "#FFFFFF", fontWeight: 700, letterSpacing: "-0.03em",
            }}
          >
            Nectar Enviro
          </Typography.Title>
          <Typography.Paragraph
            style={{ margin: "6px 0 0", color: "rgba(255, 255, 255, 0.65)", fontSize: 14, letterSpacing: "0.01em" }}
          >
            Workforce &amp; site readiness console
          </Typography.Paragraph>
        </div>

        {/* Elevated Modern Card */}
        <div
          style={{
            background: "#FFFFFF",
            padding: "32px 28px 22px",
            borderRadius: 20,
            boxShadow:
              "0 24px 60px -12px rgba(5, 15, 25, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.15), 0 1px 3px rgba(0, 0, 0, 0.05)",
          }}
        >
          {error ? (
            <Alert
              type="error"
              message={error}
              showIcon
              style={{ marginBottom: 18, borderRadius: 10, border: "1px solid rgba(196, 92, 38, 0.2)", fontSize: 13 }}
            />
          ) : null}

          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={onFinish}
            initialValues={{ email: DEMO_CREDENTIALS.email, password: DEMO_CREDENTIALS.password }}
          >
            <Form.Item
              name="email"
              label={
                <span style={sText13SemiboldColor}>Email Address</span>
              }
              rules={[
                { required: true, message: "Enter your email" },
                { type: "email", message: "Enter a valid email" },
              ]}
              style={{ marginBottom: 16 }}
            >
              <Input
                prefix={<MailOutlined style={{ color: "rgba(28, 68, 99, 0.6)", fontSize: 14 }} />}
                placeholder="you@nectarenviro.com"
                size="large"
                autoComplete="username"
                style={sText14R10Border}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={
                <span style={sText13SemiboldColor}>Password</span>
              }
              rules={[{ required: true, message: "Enter your password" }]}
              style={{ marginBottom: 20 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: "rgba(28, 68, 99, 0.6)", fontSize: 14 }} />}
                placeholder="Password"
                size="large"
                autoComplete="current-password"
                style={sText14R10Border}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
                style={{
                  height: 46, borderRadius: 10, fontWeight: 600, fontSize: 14.5, letterSpacing: "0.01em",
                  background: "linear-gradient(135deg, #1C4463 0%, #13344E 100%)", border: "none",
                  boxShadow: "0 6px 18px -2px rgba(28, 68, 99, 0.4)", cursor: "pointer",
                }}
              >
                Sign in
              </Button>
            </Form.Item>
          </Form>

          {/* Quick Demo Accounts Drawer */}
          <div style={{ paddingTop: 14, borderTop: "1px solid #EEF2F6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span
                style={{
                  fontWeight: 600, color: "#1C4463", fontSize: 11.5, letterSpacing: "0.02em",
                  textTransform: "uppercase",
                }}
              >
                Demo Accounts
              </span>
              <span
                style={{ fontSize: 11.5, color: "#64748B", background: "#F1F5F9", padding: "2px 8px", borderRadius: 6 }}
              >
                pwd:{" "}
                <code style={{ fontWeight: 650, color: "#1C4463", fontFamily: "monospace" }}>{DEMO_CREDENTIALS.password}</code>
              </span>
            </div>

            <div
              style={{
                display: "flex", flexDirection: "column", gap: 3, maxHeight: 160, overflowY: "auto", paddingRight: 2,
              }}
            >
              {DEMO_USERS_VISIBLE.map((u) => (
                <div
                  key={u.email}
                  onClick={() => handleSelectDemoUser(u.email)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleSelectDemoUser(u.email);
                    }
                  }}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "5px 8px",
                    borderRadius: 7, fontSize: 12, cursor: "pointer", transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(28, 68, 99, 0.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <code style={{ fontSize: 11.5, color: "#1C4463", fontWeight: 500 }}>{u.email}</code>
                  <span style={{ whiteSpace: "nowrap", color: "#64748B", fontSize: 11, fontWeight: 500 }}>
                    {ROLE_LABELS[u.role]}
                    {u.siteId ? ` · ${u.siteId.replace("s-", "").toUpperCase()}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <footer
        style={{
          position: "absolute", bottom: 18, left: 0, right: 0, textAlign: "center", zIndex: 10, fontSize: 11.5,
          color: "rgba(255, 255, 255, 0.4)", letterSpacing: "0.04em", pointerEvents: "none",
        }}
      >
        ETP (Effluent Treatment) · RO (Reverse Osmosis) · MEE (Multi-Effect Evaporator)
      </footer>
    </div>
  );
}

