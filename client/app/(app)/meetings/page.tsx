"use client";

import { Card, Empty, Tag, Typography } from "antd";
import { VideoCameraOutlined } from "@ant-design/icons";
import { nectarColors } from "@/lib/theme";
import { tr } from "@/lib/i18n";

export default function MeetingsPage() {
  return (
    <Card>
      <Empty
        image={
          <VideoCameraOutlined style={{ fontSize: 56, color: nectarColors.leaf }} />
        }
        description={
          <>
            <Typography.Title level={4} style={{ marginBottom: 4 }}>{tr("Meetings")}{" "}<Tag color="gold">{tr("Coming soon")}</Tag></Typography.Title>
            <Typography.Text type="secondary">
              {tr("Schedule site meetings, track attendance and share minutes — all in one place. This module is under development.")}
            </Typography.Text>
          </>
        }
      />
    </Card>
  );
}
