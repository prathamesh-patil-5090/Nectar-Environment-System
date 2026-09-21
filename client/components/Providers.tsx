"use client";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, App } from "antd";
import { nectarTheme } from "@/lib/theme";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider theme={nectarTheme}>
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
