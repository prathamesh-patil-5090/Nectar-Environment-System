"use client";

import { useState } from "react";
import { Alert, App, Button, Empty, Modal, Radio, Space } from "antd";
import { submitSkillMapping } from "@/lib/training/store";
import type { Course } from "@/lib/training/types";
import { tr, trData } from "@/lib/i18n";

/**
 * Assessment gate 1: the skill-mapping test, taken online after every ability is done.
 * Questions come from the course in the database; scoring is confirmed by the server.
 */
export default function SkillMapGateModal({
  open,
  course,
  enrollmentId,
  onClose,
  onPassed,
}: {
  open: boolean;
  course: Course;
  enrollmentId: string;
  onClose: () => void;
  onPassed: () => void;
}) {
  const { message } = App.useApp();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const questions = course.skillMappingQuestions ?? [];
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id]);

  const submit = () => {
    const res = submitSkillMapping(enrollmentId, answers);
    if (res.passed) {
      message.success(tr("Skill map passed with {scorePct}%.", { scorePct: res.scorePct }));
      setAnswers({});
      onPassed();
    } else {
      message.error(tr("Scored {scorePct}%. {passThreshold}% is needed. Review the abilities and try again.", { scorePct: res.scorePct, passThreshold: course.passThreshold }));
    }
  };

  return (
    <Modal
      open={open}
      title={tr("Skill mapping test · {code}", { code: course.code })}
      onCancel={onClose}
      width={720}
      footer={
        questions.length ? (
          <Space>
            <Button onClick={onClose}>{tr("Cancel")}</Button>
            <Button type="primary" disabled={!allAnswered} onClick={submit}>{tr("Submit")}</Button>
          </Space>
        ) : (
          <Button onClick={onClose}>{tr("Close")}</Button>
        )
      }
    >
      {questions.length === 0 ? (
        <Empty description={tr("The skill mapping questions for this course are not set up yet. HR or the Director can add them.")} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Alert type="info" showIcon title={tr("Pass mark {passThreshold}%. Passing unlocks the written test and the on-site practical.", { passThreshold: course.passThreshold })} />
          {questions.map((q, i) => (
            <div key={q.id} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{i + 1}. {trData(q.text)}</div>
              <Radio.Group value={answers[q.id]} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}>
                <Space direction="vertical">
                  {q.options.map((o) => <Radio key={o.id} value={o.id}>{trData(o.text)}</Radio>)}
                </Space>
              </Radio.Group>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
