"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Form, Input, Typography } from "antd";
import { LockOutlined, MailOutlined } from "@ant-design/icons";
import {
  DEMO_CREDENTIALS,
  DEMO_USERS,
  isAuthenticated,
  login,
  ROLE_LABELS,
} from "@/lib/auth";
import { nectarColors } from "@/lib/theme";

type LoginValues = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        position: "relative",
        overflow: "hidden",
        background: `
          radial-gradient(ellipse 80% 60% at 10% 20%, rgba(63,174,124,0.28), transparent 55%),
          radial-gradient(ellipse 70% 50% at 90% 80%, rgba(31,107,74,0.22), transparent 50%),
          linear-gradient(160deg, #E8F2EC 0%, ${nectarColors.sand} 45%, #DCE8E2 100%)
        `,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.07,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 8c8 6 14 14 14 22a14 14 0 1 1-28 0c0-8 6-16 14-22z' fill='%230F2A24' fill-opacity='0.9'/%3E%3C/svg%3E")`,
          backgroundSize: "60px 60px",
          pointerEvents: "none",
        }}
      />

      <div
        className="nectar-login-enter"
        style={{
          width: "100%",
          maxWidth: 420,
          position: "relative",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 52,
              margin: "0 auto 16px",
              borderRadius: 14,
              background: `linear-gradient(145deg, ${nectarColors.mint}, ${nectarColors.leaf})`,
              display: "grid",
              placeItems: "center",
              boxShadow: "0 8px 24px rgba(31,107,74,0.25)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3c4 3 7 7 7 11a7 7 0 1 1-14 0c0-4 3-8 7-11Z"
                fill="white"
              />
            </svg>
          </div>
          <Typography.Title
            level={1}
            style={{
              margin: 0,
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontSize: 36,
              color: nectarColors.ink,
              fontWeight: 650,
            }}
          >
            Nectar Enviro
          </Typography.Title>
          <Typography.Paragraph
            style={{
              margin: "8px 0 0",
              color: nectarColors.muted,
              fontSize: 15,
            }}
          >
            Workforce &amp; site readiness.
          </Typography.Paragraph>
        </div>

        <div
          style={{
            background: nectarColors.white,
            padding: "28px 28px 24px",
            borderRadius: 12,
            border: "1px solid rgba(15,42,36,0.08)",
          }}
        >
          {error ? (
            <Alert
              type="error"
              message={error}
              showIcon
              style={{ marginBottom: 16 }}
            />
          ) : null}

          <Form
            layout="vertical"
            requiredMark={false}
            onFinish={onFinish}
            initialValues={{
              email: DEMO_CREDENTIALS.email,
              password: DEMO_CREDENTIALS.password,
            }}
          >
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: "Enter your email" },
                { type: "email", message: "Enter a valid email" },
              ]}
            >
              <Input
                prefix={<MailOutlined style={{ color: nectarColors.muted }} />}
                placeholder="you@nectarenviro.com"
                size="large"
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: "Enter your password" }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: nectarColors.muted }} />}
                placeholder="Password"
                size="large"
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
              >
                Sign in
              </Button>
            </Form.Item>
          </Form>

          <div
            style={{
              margin: "12px 0 0",
              fontSize: 12,
              color: nectarColors.muted,
              textAlign: "left",
              lineHeight: 1.55,
              background: "rgba(15,42,36,0.04)",
              borderRadius: 8,
              padding: "10px 12px",
            }}
          >
            <div style={{ marginBottom: 6, textAlign: "center" }}>
              Demo accounts (password <code>{DEMO_CREDENTIALS.password}</code>)
            </div>
            {DEMO_USERS.map((u) => (
              <div
                key={u.email}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "2px 0",
                }}
              >
                <code style={{ fontSize: 11 }}>{u.email}</code>
                <span>{ROLE_LABELS[u.role]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
