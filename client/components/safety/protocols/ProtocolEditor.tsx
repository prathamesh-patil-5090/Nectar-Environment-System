"use client";

import { useEffect, useState } from "react";
import { App, AutoComplete, Button, Drawer, Form, Input, Select, Tooltip } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import type { SafetyProtocol } from "@/lib/safety/types";
import { KNOWN_PROTOCOL_CATEGORIES, categoryKey, categoryMeta } from "./protocol-meta";
import { nectarColors } from "@/lib/theme";
import styles from "./protocols.module.css";

type Contact = { label: string; phone: string };
type Values = {
  title: string;
  category: string;
  summary?: string;
  steps: string[];
  emergencyContacts: Contact[];
  siteIds: string[];
};

const QUICK_CONTACTS: Contact[] = [
  { label: "Emergency (all services)", phone: "112" },
  { label: "Ambulance", phone: "108" },
  { label: "Fire brigade", phone: "101" },
];

const blank: Values = { title: "", category: "", summary: "", steps: ["", ""], emergencyContacts: [QUICK_CONTACTS[0]], siteIds: [] };

/** Create / edit a protocol. Steps and contacts are structured rows (reorderable), not free text. */
export default function ProtocolEditor({
  open,
  protocol,
  categories,
  sites,
  saving,
  onSave,
  onClose,
}: {
  open: boolean;
  protocol: SafetyProtocol | null;
  categories: string[];
  sites: { id: string; name: string }[];
  saving: boolean;
  onSave: (values: Omit<SafetyProtocol, "id" | "version" | "updatedBy" | "updatedAtIso">) => Promise<boolean>;
  onClose: () => void;
}) {
  const { modal } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [formKey, setFormKey] = useState(0);

  // Fresh form every time the drawer opens
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setFormKey((k) => k + 1));
    return () => cancelAnimationFrame(id);
  }, [open, protocol]);

  const initial: Values = protocol
    ? {
        title: protocol.title,
        category: categoryMeta(protocol.category).label,
        summary: protocol.summary,
        steps: protocol.steps.length ? protocol.steps : [""],
        emergencyContacts: protocol.emergencyContacts,
        siteIds: protocol.siteIds,
      }
    : blank;

  // Friendly labels in the field; saved as a stable key (categoryKey)
  const categoryOptions = [
    ...new Set([...KNOWN_PROTOCOL_CATEGORIES, ...categories].map((c) => categoryMeta(c).label)),
  ].map((label) => ({ value: label }));

  const requestClose = () => {
    if (!form.isFieldsTouched()) return onClose();
    modal.confirm({
      title: "Discard changes?",
      content: "Your edits to this protocol will be lost.",
      okText: "Discard",
      okButtonProps: { danger: true },
      onOk: onClose,
    });
  };

  const submit = async (v: Values) => {
    const ok = await onSave({
      title: v.title.trim(),
      category: categoryKey(v.category),
      summary: (v.summary ?? "").trim(),
      steps: v.steps.map((s) => (s ?? "").trim()).filter(Boolean),
      emergencyContacts: (v.emergencyContacts ?? [])
        .filter((c) => c?.label?.trim() && c?.phone?.trim())
        .map((c) => ({ label: c.label.trim(), phone: c.phone.trim() })),
      siteIds: v.siteIds ?? [],
    });
    if (ok) onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={requestClose}
      size="min(600px, 100vw)"
      title={protocol ? `Edit · ${protocol.title}` : "New emergency protocol"}
      destroyOnHidden
      rootClassName={styles.tokens}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: nectarColors.muted, alignSelf: "center" }}>
            {protocol ? `Saving creates version ${protocol.version + 1}` : "Visible to everyone once saved"}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={requestClose}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={() => form.submit()}>
              {protocol ? "Save changes" : "Publish protocol"}
            </Button>
          </div>
        </div>
      }
    >
      <Form<Values> key={formKey} form={form} layout="vertical" initialValues={initial} onFinish={submit} requiredMark="optional">
        <Form.Item name="title" label="Title" rules={[{ required: true, whitespace: true, message: "Give the protocol a title" }, { max: 200 }]}>
          <Input placeholder="e.g. Chlorine gas leak" />
        </Form.Item>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 12 }}>
          <Form.Item name="category" label="Category" rules={[{ required: true, whitespace: true, message: "Pick or type a category" }]}>
            <AutoComplete options={categoryOptions} placeholder="fire, chemical, electrical…" filterOption={(input, opt) => String(opt?.value ?? "").toLowerCase().includes(input.toLowerCase())} />
          </Form.Item>
          <Form.Item name="siteIds" label="Applies to" tooltip="Leave empty for all sites">
            <Select mode="multiple" allowClear placeholder="All sites" options={sites.map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
        </div>
        <Form.Item name="summary" label="Key message" tooltip="The one thing people must remember — shown above the steps">
          <Input.TextArea rows={2} maxLength={300} showCount placeholder="e.g. Cut the power first — never touch a person still in contact" />
        </Form.Item>

        <div className={styles.sectionTitle}>Steps — in the order to do them</div>
        <Form.List
          name="steps"
          rules={[
            {
              validator: async (_, steps: string[]) => {
                if (!steps?.some((s) => s?.trim())) throw new Error("Add at least one step");
              },
            },
          ]}
        >
          {(fields, { add, remove, move }, { errors }) => (
            <>
              {fields.map((field, i) => (
                <div key={field.key} className={styles.stepRow}>
                  <span className={styles.stepRowNo}>{i + 1}</span>
                  <Form.Item name={field.name} style={{ marginBottom: 0 }}>
                    <Input.TextArea autoSize={{ minRows: 1, maxRows: 5 }} maxLength={1000} placeholder={i === 0 ? "First thing to do" : "Next step"} />
                  </Form.Item>
                  <div className={styles.stepRowTools}>
                    <Tooltip title="Move up">
                      <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move step ${i + 1} up`} />
                    </Tooltip>
                    <Tooltip title="Move down">
                      <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={i === fields.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move step ${i + 1} down`} />
                    </Tooltip>
                    <Tooltip title="Remove">
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} disabled={fields.length === 1} onClick={() => remove(field.name)} aria-label={`Remove step ${i + 1}`} />
                    </Tooltip>
                  </div>
                </div>
              ))}
              <Form.ErrorList errors={errors} />
              <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add("")} style={{ marginBottom: 20 }}>
                Add step
              </Button>
            </>
          )}
        </Form.List>

        <div className={styles.sectionTitle}>Who to call</div>
        <Form.List name="emergencyContacts">
          {(fields, { add, remove }) => {
            const current: Contact[] = form.getFieldValue("emergencyContacts") ?? [];
            const missing = QUICK_CONTACTS.filter((q) => !current.some((c) => c?.phone === q.phone));
            return (
              <>
                {fields.map((field) => (
                  <div key={field.key} className={styles.contactRow}>
                    <Form.Item name={[field.name, "label"]} rules={[{ required: true, whitespace: true, message: "Who is this?" }]}>
                      <Input placeholder="e.g. Plant manager (night)" maxLength={100} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, "phone"]}
                      rules={[
                        { required: true, message: "Number" },
                        { pattern: /^[0-9+\-\s()]{3,20}$/, message: "Digits, +, - or spaces only" },
                      ]}
                    >
                      <Input placeholder="Number" inputMode="tel" maxLength={20} />
                    </Form.Item>
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} aria-label="Remove contact" />
                  </div>
                ))}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <Button icon={<PlusOutlined />} onClick={() => add({ label: "", phone: "" })}>Add contact</Button>
                  {missing.map((q) => (
                    <Button key={q.phone} type="dashed" onClick={() => add(q)}>+ {q.phone} {q.label}</Button>
                  ))}
                </div>
              </>
            );
          }}
        </Form.List>
      </Form>
    </Drawer>
  );
}
