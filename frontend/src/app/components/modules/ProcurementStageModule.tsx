import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Edit,
  FileUp,
  LoaderCircle,
  Trash2,
  Upload,
  ChevronRight,
  ChevronDown,
  Paperclip,
} from "lucide-react";
import { FilterBar, createEmptyFilterValues, type FilterValues } from "../FilterBar";
import { useNavigate, useSearchParams } from "react-router";
import {
  commentDocument,
  deleteDocument,
  getDocumentDownloadUrl,
  getStageFromFrontend,
  listDocuments,
  listStageRecords,
  listValueHelp,
  replaceDocument,
  reviewDocument,
  uploadDocuments,
} from "../../lib/api";
import { formatCurrency, formatDate, formatFileSize } from "../../lib/format";
import { ModuleFooterAlerts, SelectionPlaceholder } from "./ModuleExperience";
import type {
  FrontendStageKey,
  GRNRecord,
  PORecord,
  PRRecord,
  StageDocument,
  StageKey,
  ValueHelpItem,
} from "../../lib/types";

// ─── Config ────────────────────────────────────────────────────────────────────

type StageModuleConfig = {
  frontendStage: Exclude<FrontendStageKey, "INV">;
  title: string;
  description: string;
  multiUpload: boolean;
  uploadLabel: string;
  changeLabel: string;
  viewLabel: string;
};

type ProcurementRecord = PRRecord | PORecord | GRNRecord;
type StageFilterKey = keyof FilterValues;

function isPRRecord(record: ProcurementRecord): record is PRRecord {
  return "pr_number" in record && "document_type" in record && !("po_number" in record) && !("grn_number" in record);
}

function isPORecord(record: ProcurementRecord): record is PORecord {
  return "po_number" in record && "vendor" in record && "company_code" in record && !("grn_number" in record);
}

function isGRNRecord(record: ProcurementRecord): record is GRNRecord {
  return "grn_number" in record && "document_date" in record && "posting_date" in record;
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: "12px",
  fontWeight: "700",
  color: "#32363a",
  borderBottom: "1px solid #d9d9d9",
  borderRight: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
  backgroundColor: "#f5f5f5",
  textAlign: "left",
  position: "sticky",
  top: 0,
  zIndex: 2,
};

const TD: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: "12px",
  color: "#32363a",
  borderBottom: "1px solid #eee",
  borderRight: "1px solid #f0f0f0",
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

const SUB_TH: React.CSSProperties = {
  padding: "7px 12px",
  fontSize: "11px",
  fontWeight: "700",
  color: "#64748b",
  borderBottom: "1px solid #e2e8f0",
  borderRight: "1px solid #e8edf2",
  whiteSpace: "nowrap",
  backgroundColor: "#f8fafc",
  textAlign: "left",
};

const SUB_TD: React.CSSProperties = {
  padding: "7px 12px",
  fontSize: "11px",
  color: "#334155",
  borderBottom: "1px solid #f1f5f9",
  borderRight: "1px solid #f1f5f9",
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

// ─── Record helpers ─────────────────────────────────────────────────────────────

function getReference(r: ProcurementRecord) {
  if (isGRNRecord(r)) return r.grn_number;
  if (isPORecord(r)) return r.po_number;
  return r.pr_number;
}
function getDocType(r: ProcurementRecord) {
  return isPRRecord(r) ? r.document_type : "Material Document";
}
function getStatus(r: ProcurementRecord) {
  return r.status || "Open";
}
function getPlant(r: ProcurementRecord) {
  return r.items[0]?.plant || "—";
}
function getMaterial(r: ProcurementRecord) {
  return r.items[0]?.material || "—";
}
function getStorageLocation(r: ProcurementRecord) {
  return r.items[0]?.storage_location || "—";
}
function getTotalValue(r: ProcurementRecord) {
  if (isPRRecord(r)) {
    return r.items.reduce((s, i) => s + i.amount, 0);
  }
  if (isPORecord(r)) {
    return r.items.reduce((s, i) => s + i.amount, 0);
  }
  return r.items.reduce((s, i) => s + i.amount, 0);
}
function getYear(r: ProcurementRecord) {
  if (isGRNRecord(r)) return new Date(r.document_date).getFullYear().toString();
  return new Date(r.created_at).getFullYear().toString();
}
function getStageFilterKeys(stage: Exclude<FrontendStageKey, "INV">): StageFilterKey[] {
  if (stage === "PR") return ["search", "editingStatus", "docNumber", "documentType"];
  if (stage === "PO") return ["search", "editingStatus", "purchaseOrder", "material", "plant", "companyCode", "purchasingGroup"];
  return ["search", "editingStatus", "materialDocument", "materialDocumentYear", "material", "plant"];
}
function getPrimaryFilterKey(stage: Exclude<FrontendStageKey, "INV">): StageFilterKey {
  if (stage === "PO") return "purchaseOrder";
  if (stage === "GRN") return "materialDocument";
  return "docNumber";
}
function filtersFromSearchParams(stage: Exclude<FrontendStageKey, "INV">, searchParams: URLSearchParams) {
  const primaryKey = getPrimaryFilterKey(stage);
  const docValue = searchParams.get("doc");
  const next = createEmptyFilterValues();

  for (const key of getStageFilterKeys(stage)) {
    next[key] = searchParams.get(key) ?? "";
  }

  if (docValue && !next[primaryKey]) {
    next[primaryKey] = docValue;
  }

  return next;
}
function buildListSearchParams(stage: Exclude<FrontendStageKey, "INV">, action: "upload" | "change" | "view", filters: FilterValues) {
  const params = new URLSearchParams();
  params.set("tab", stage);
  params.set("action", action);

  const primaryKey = getPrimaryFilterKey(stage);
  const primaryValue = filters[primaryKey].trim();
  if (primaryValue) {
    params.set("doc", primaryValue);
  }

  for (const key of getStageFilterKeys(stage)) {
    const value = filters[key].trim();
    if (value) {
      params.set(key, value);
    }
  }

  return params;
}
function buildFieldOptions(records: ProcurementRecord[], stage: Exclude<FrontendStageKey, "INV">) {
  const opts = (vals: string[]) => Array.from(new Set(vals.filter(Boolean))).sort();
  if (stage === "PR") return { editingStatus: opts(records.map(getStatus)), documentType: opts(records.map(getDocType)) };
  if (stage === "PO") return { editingStatus: opts(records.map(getStatus)) };
  return { editingStatus: opts(records.map(getStatus)) };
}

// ─── Filter matching ────────────────────────────────────────────────────────────

function inc(v: string | undefined, s: string) {
  return (v || "").toLowerCase().includes(s.toLowerCase());
}
function matchesFilters(r: ProcurementRecord, f: FilterValues, stage: Exclude<FrontendStageKey, "INV">) {
  const ref = getReference(r);
  const search = f.search.trim().toLowerCase();
  if (search && ![ref, getPlant(r), getMaterial(r), getStorageLocation(r), getStatus(r), getDocType(r)].join(" ").toLowerCase().includes(search)) return false;
  if (stage === "PR") {
    if (f.docNumber && ref !== f.docNumber) return false;
    if (f.editingStatus && getStatus(r) !== f.editingStatus) return false;
    if (f.documentType && getDocType(r) !== f.documentType) return false;
    return true;
  }
  if (stage === "PO") {
    if (!isPORecord(r)) return false;
    const po = r;
    if (search && ![ref, getPlant(r), getMaterial(r), getStatus(r), po.company_code, po.purchase_group].join(" ").toLowerCase().includes(search)) return false;
    if (f.purchaseOrder && po.po_number !== f.purchaseOrder) return false;
    if (f.editingStatus && getStatus(r) !== f.editingStatus) return false;
    if (f.purchasingGroup && !inc(po.purchase_group, f.purchasingGroup)) return false;
    if (f.companyCode && !inc(po.company_code, f.companyCode)) return false;
    if (f.material && !po.items.some((i) => inc(i.material, f.material))) return false;
    if (f.plant && !inc(getPlant(r), f.plant)) return false;
    return true;
  }
  if (!isGRNRecord(r)) return false;
  const grn = r;
  if (search && ![ref, getPlant(r), getMaterial(r), getStatus(r), getYear(grn)].join(" ").toLowerCase().includes(search)) return false;
  if (f.materialDocument && grn.grn_number !== f.materialDocument) return false;
  if (f.editingStatus && getStatus(r) !== f.editingStatus) return false;
  if (f.plant && !inc(getPlant(r), f.plant)) return false;
  if (f.materialDocumentYear && getYear(grn) !== f.materialDocumentYear) return false;
  if (f.material && !grn.items.some((i) => inc(i.material, f.material))) return false;
  return true;
}

// ─── Column headers ─────────────────────────────────────────────────────────────

function getHeaders(stage: Exclude<FrontendStageKey, "INV">) {
  if (stage === "PR") return ["Purchase Requisition", "Document Type", "Total Value", "Number of Items", "Status", "Origin", "Currency"];
  if (stage === "PO") {
    return [
      "Purchase Order Number",
      "Purchase Document Type",
      "Purchasing Group",
      "Company Code",
      "Purchase Order Date",
      "Net Order Value",
      "Purchase Organization",
      "Purchase Requisition Number",
    ];
  }
  return ["Material Document", "Year", "Material", "Plant", "Storage Location", "Posting Date"];
}

// ─── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ text }: { text: string }) {
  const lower = text.toLowerCase();
  const isGreen = lower.includes("open") || lower.includes("follow") || lower.includes("created");
  return (
    <span style={{
      fontSize: "11px", fontWeight: "600",
      color: isGreen ? "#107E3E" : "#6A6D70",
      backgroundColor: isGreen ? "#eef5ec" : "#f5f5f5",
      padding: "2px 8px", borderRadius: "4px", display: "inline-block",
    }}>
      {text}
    </span>
  );
}

// ─── Summary row cells ──────────────────────────────────────────────────────────

function SummaryRowCells({ record, stage }: { record: ProcurementRecord; stage: Exclude<FrontendStageKey, "INV"> }) {
  if (stage === "PR") {
    const pr = record as PRRecord;
    return (
      <>
        <td style={{ ...TD, color: "#0070F2", fontWeight: "700", minWidth: "160px" }}>{pr.pr_number}</td>
        <td style={{ ...TD, minWidth: "160px" }}>{pr.document_type}</td>
        <td style={{ ...TD, minWidth: "120px" }}>{formatCurrency(getTotalValue(pr))}</td>
        <td style={{ ...TD, minWidth: "120px" }}>{pr.items.length}</td>
        <td style={{ ...TD, minWidth: "120px" }}><StatusBadge text={pr.status || "OPEN"} /></td>
        <td style={{ ...TD, minWidth: "160px" }}>Realtime (manual)</td>
        <td style={{ ...TD, minWidth: "80px", borderRight: "none" }}>INR</td>
      </>
    );
  }
  if (stage === "PO") {
    const po = record as PORecord;
    return (
      <>
        <td style={{ ...TD, color: "#0070F2", fontWeight: "700", minWidth: "160px" }}>{po.po_number}</td>
        <td style={{ ...TD, minWidth: "180px" }}>{po.document_type}</td>
        <td style={{ ...TD, minWidth: "160px" }}>{po.purchase_group}</td>
        <td style={{ ...TD, minWidth: "160px" }}>{po.company_code}</td>
        <td style={{ ...TD, minWidth: "150px" }}>{po.purchase_order_date ? formatDate(po.purchase_order_date) : ""}</td>
        <td style={{ ...TD, minWidth: "140px" }}>{po.net_order_value == null ? "" : formatCurrency(po.net_order_value)}</td>
        <td style={{ ...TD, minWidth: "170px" }}>{po.purchase_organization}</td>
        <td style={{ ...TD, minWidth: "200px", borderRight: "none" }}>{po.pr_number}</td>
      </>
    );
  }
  const grn = record as GRNRecord;
  return (
    <>
      <td style={{ ...TD, color: "#0070F2", fontWeight: "700", minWidth: "160px" }}>{grn.grn_number}</td>
      <td style={{ ...TD, minWidth: "80px" }}>{getYear(grn)}</td>
      <td style={{ ...TD, minWidth: "200px" }}>{getMaterial(grn)}</td>
      <td style={{ ...TD, minWidth: "160px" }}>{getPlant(grn)}</td>
      <td style={{ ...TD, minWidth: "160px" }}>{getStorageLocation(grn)}</td>
      <td style={{ ...TD, minWidth: "120px", borderRight: "none" }}>{formatDate(grn.posting_date)}</td>
    </>
  );
}

// ─── Items sub-table ────────────────────────────────────────────────────────────

function ItemsSubTable({ record, stage }: { record: ProcurementRecord; stage: Exclude<FrontendStageKey, "INV"> }) {
  if (stage === "PR") {
    const pr = record as PRRecord;
    const cols = ["Item Number", "Material", "Material Description", "Plant", "Quantity", "Price", "Amount", "Purchase Organization"];
    return (
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "960px" }}>
        <thead><tr>{cols.map((c) => <th key={c} style={SUB_TH}>{c}</th>)}</tr></thead>
        <tbody>
          {pr.items.map((item, i) => (
            <tr key={item.item_number} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#fafbfc" }}>
              <td style={SUB_TD}>{item.item_number || "—"}</td>
              <td style={{ ...SUB_TD, color: "#0070F2" }}>{item.material || "—"}</td>
              <td style={SUB_TD}>{item.material_description || "—"}</td>
              <td style={SUB_TD}>{item.plant}</td>
              <td style={SUB_TD}>{item.quantity}</td>
              <td style={SUB_TD}>{formatCurrency(item.price)}</td>
              <td style={SUB_TD}>{formatCurrency(item.amount)}</td>
              <td style={{ ...SUB_TD, borderRight: "none" }}>{item.purchase_organization || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (stage === "PO") {
    const po = record as PORecord;
    const cols = ["Item Number", "Material", "Material Description", "Quantity", "Price", "Amount", "Plant"];
    return (
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "900px" }}>
        <thead><tr>{cols.map((c) => <th key={c} style={SUB_TH}>{c}</th>)}</tr></thead>
        <tbody>
          {po.items.map((item, i) => (
            <tr key={item.item_number} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#fafbfc" }}>
              <td style={SUB_TD}>{item.item_number || "—"}</td>
              <td style={{ ...SUB_TD, color: "#0070F2" }}>{item.material}</td>
              <td style={SUB_TD}>{item.material_description || "—"}</td>
              <td style={SUB_TD}>{item.quantity}</td>
              <td style={SUB_TD}>{formatCurrency(item.price)}</td>
              <td style={SUB_TD}>{formatCurrency(item.amount)}</td>
              <td style={{ ...SUB_TD, borderRight: "none" }}>{item.plant}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  const grn = record as GRNRecord;
  const cols = ["Item Number", "Material", "Material Description", "Quantity", "Price", "Amount", "Plant", "Purchase Order"];
  return (
    <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "960px" }}>
      <thead><tr>{cols.map((c) => <th key={c} style={SUB_TH}>{c}</th>)}</tr></thead>
      <tbody>
        {grn.items.map((item, i) => (
          <tr key={item.item_number} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#fafbfc" }}>
            <td style={SUB_TD}>{item.item_number || "—"}</td>
            <td style={{ ...SUB_TD, color: "#0070F2" }}>{item.material}</td>
            <td style={SUB_TD}>{item.material_description || "—"}</td>
            <td style={SUB_TD}>{item.quantity}</td>
            <td style={SUB_TD}>{formatCurrency(item.price)}</td>
            <td style={SUB_TD}>{formatCurrency(item.amount)}</td>
            <td style={SUB_TD}>{item.plant}</td>
            <td style={{ ...SUB_TD, color: "#0070F2", borderRight: "none" }}>{item.purchase_order || grn.po_number}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Documents panel ────────────────────────────────────────────────────────────

function DocumentsPanel({
  reference, stage, docs, docsLoading, mode, onReview, onComment, onReplace, onDelete,
}: {
  reference: string; stage: StageKey; docs: StageDocument[];
  docsLoading: boolean;
  mode: "change" | "view";
  onReview: (reference: string, doc: StageDocument, decision: "ACCEPTED" | "REJECTED", comment?: string) => Promise<void>;
  onComment: (reference: string, doc: StageDocument, comment?: string) => Promise<void>;
  onReplace: (reference: string, doc: StageDocument, file: File) => Promise<void>;
  onDelete: (reference: string, doc: StageDocument) => Promise<void>;
}) {
  const cols = ["File Name", "Reference", "Version", "Upload Date", "Uploaded By", "Decision", "Size", "Actions"];
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ mode: "reject"; docId: string } | null>(null);
  const [deletePromptDocId, setDeletePromptDocId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const activeDoc = docs.find((doc) => doc._id === selectedDocId) || docs[0] || null;

  useEffect(() => {
    setSelectedDocId((current) => {
      if (current && docs.some((doc) => doc._id === current)) return current;
      return docs[0]?._id ?? null;
    });
  }, [docs]);

  const openEditor = (mode: "reject", doc: StageDocument) => {
    setSelectedDocId(doc._id);
    setEditor({ mode, docId: doc._id });
    setDraftText(doc.review_status === "REJECTED" ? doc.attachment_comment || doc.review_comment || "" : "");
  };

  const closeEditor = () => {
    setEditor(null);
    setDraftText("");
  };

  const closeDeletePrompt = () => {
    setDeletePromptDocId(null);
  };

  const handleDeleteComment = async () => {
    if (!activeDoc || deletePromptDocId !== activeDoc._id) return;
    setSubmitting(true);
    try {
      await onComment(reference, activeDoc, undefined);
      closeDeletePrompt();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!editor) return;
    const doc = docs.find((item) => item._id === editor.docId);
    if (!doc) return;
    const cleanText = draftText.trim();
    if (stage === "GRN" && !cleanText) return;

    setSubmitting(true);
    try {
      await onComment(reference, doc, cleanText || undefined);
      await onReview(reference, doc, "REJECTED", undefined);
      closeEditor();
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplaceClick = (doc: StageDocument) => {
    setSelectedDocId(doc._id);
    setBusyDocId(doc._id);
    replaceInputRef.current?.click();
  };

  const handleReplaceChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const doc = docs.find((item) => item._id === busyDocId);
    event.target.value = "";
    if (!file || !doc) {
      setBusyDocId(null);
      return;
    }

    try {
      await onReplace(reference, doc, file);
    } finally {
      setBusyDocId(null);
    }
  };

  const handleDeleteClick = async (doc: StageDocument) => {
    setSelectedDocId(doc._id);
    const confirmed = window.confirm(`Delete "${doc.original_filename}" from ${reference}?`);
    if (!confirmed) return;
    setBusyDocId(doc._id);
    try {
      await onDelete(reference, doc);
    } finally {
      setBusyDocId(null);
    }
  };

  return (
    <div style={{ borderTop: "1px solid #dbeafe" }}>
      <input
        ref={replaceInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.doc,.docx,.xls,.xlsx,.csv,.txt"
        style={{ display: "none" }}
        onChange={(event) => void handleReplaceChange(event)}
      />
      <div style={{ padding: "8px 14px", backgroundColor: "#f0f7ff", borderBottom: "1px solid #dbeafe", display: "flex", alignItems: "center", gap: "6px" }}>
        <Paperclip size={12} color="#1d4ed8" />
        <span style={{ fontSize: "11px", fontWeight: "700", color: "#1e40af" }}>
          Uploaded Documents ({docsLoading ? "…" : docs.length})
        </span>
      </div>
      {docsLoading ? (
        <div style={{ padding: "14px 16px", fontSize: "12px", color: "#6A6D70", display: "flex", alignItems: "center", gap: "6px" }}>
          <LoaderCircle size={14} className="animate-spin" /> Loading documents…
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "860px" }}>
            <thead><tr>{cols.map((c) => <th key={c} style={SUB_TH}>{c}</th>)}</tr></thead>
            <tbody>
              {docs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "16px 14px", textAlign: "center", fontSize: "12px", color: "#94a3b8" }}>
                    No documents uploaded for <strong>{reference}</strong>.
                  </td>
                </tr>
              ) : docs.map((doc, i) => (
                <tr key={doc._id} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#fafbfc" }}>
                  <td style={{ ...SUB_TD, minWidth: "240px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <a
                        href={getDocumentDownloadUrl(stage, doc._id, true)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setSelectedDocId(doc._id)}
                        style={{ color: "#0070F2", fontWeight: "600", textDecoration: "none", cursor: "pointer" }}
                      >
                        {doc.original_filename}
                      </a>
                      <a
                        href={getDocumentDownloadUrl(stage, doc._id)}
                        aria-label={`Download ${doc.original_filename}`}
                        style={{ color: "#64748b", display: "inline-flex", alignItems: "center", cursor: "pointer" }}
                      >
                        <Download size={12} />
                      </a>
                    </div>
                  </td>
                  <td style={SUB_TD}>{reference}</td>
                  <td style={SUB_TD}>v{doc.version}</td>
                  <td style={SUB_TD}>{formatDate(doc.uploaded_at)}</td>
                  <td style={SUB_TD}>{doc.uploaded_by || "system"}</td>
                  <td style={SUB_TD}>{doc.review_status}</td>
                  <td style={SUB_TD}>{formatFileSize(doc.file_size)}</td>
                  <td style={{ ...SUB_TD, borderRight: "none" }}>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <button onClick={() => void onReview(reference, doc, "ACCEPTED")}
                        disabled={busyDocId === doc._id}
                        style={{ display: "flex", alignItems: "center", gap: "3px", padding: "3px 8px", border: "1px solid #107E3E", color: "#107E3E", borderRadius: "6px", fontSize: "10px", fontWeight: "600", backgroundColor: "#ffffff", cursor: "pointer" }}>
                        <span style={{ color: "#107E3E", fontSize: "11px", fontWeight: "800", lineHeight: 1 }}>✓</span>
                        Approve
                      </button>
                      <button onClick={() => openEditor("reject", doc)}
                        disabled={busyDocId === doc._id}
                        style={{ display: "flex", alignItems: "center", gap: "3px", padding: "3px 8px", border: "1px solid #BB0000", color: "#BB0000", borderRadius: "6px", fontSize: "10px", fontWeight: "600", backgroundColor: "#ffffff", cursor: "pointer" }}>
                        <span style={{ color: "#BB0000", fontSize: "11px", fontWeight: "800", lineHeight: 1 }}>X</span>
                        Reject
                      </button>
                      {mode === "change" ? (
                        <>
                          <button
                            onClick={() => handleReplaceClick(doc)}
                            disabled={busyDocId === doc._id}
                            style={{ display: "flex", alignItems: "center", gap: "3px", padding: "3px 8px", border: "1px solid #0070F2", color: "#0070F2", borderRadius: "6px", fontSize: "10px", fontWeight: "600", backgroundColor: "#ffffff", cursor: "pointer" }}
                          >
                            {busyDocId === doc._id ? "Working..." : "Replace"}
                          </button>
                          <button
                            onClick={() => void handleDeleteClick(doc)}
                            disabled={busyDocId === doc._id}
                            style={{ display: "flex", alignItems: "center", gap: "3px", padding: "3px 8px", border: "1px solid #64748b", color: "#64748b", borderRadius: "6px", fontSize: "10px", fontWeight: "600", backgroundColor: "#ffffff", cursor: "pointer" }}
                          >
                            {busyDocId === doc._id ? "Working..." : "Delete"}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeDoc && activeDoc.review_status === "REJECTED" ? (
        <div style={{ borderTop: "1px solid #dbeafe", backgroundColor: "#fbfdff", padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "#0f172a", textAlign: "center" }}>Rejected Comment</div>
            <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px", textAlign: "center" }}>{activeDoc.original_filename}</div>
          </div>

          {activeDoc.review_status === "REJECTED" ? (
            <div style={{ width: "100%", maxWidth: "560px", padding: "12px 14px", border: "1px solid #fde68a", borderRadius: "10px", backgroundColor: "#fffdf5" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <div style={{ fontSize: "10px", fontWeight: "700", color: "#b45309" }}>Comment</div>
                <button
                  type="button"
                  onClick={() => openEditor("reject", activeDoc)}
                  style={{ display: "flex", alignItems: "center", gap: "4px", border: "none", backgroundColor: "transparent", color: "#0070F2", fontSize: "10px", fontWeight: "700", cursor: "pointer" }}
                >
                  <Edit size={11} />
                  Edit Comment
                </button>
              </div>
              <div style={{ fontSize: "11px", color: "#334155", whiteSpace: "pre-wrap", marginTop: "6px" }}>
                {activeDoc.attachment_comment || activeDoc.review_comment || "No rejection comment added."}
              </div>
              <button
                type="button"
                onClick={() => setDeletePromptDocId(activeDoc._id)}
                style={{ display: "flex", alignItems: "center", gap: "4px", border: "none", backgroundColor: "transparent", color: "#BB0000", fontSize: "10px", fontWeight: "700", cursor: "pointer", marginTop: "10px", marginLeft: "auto" }}
              >
                <Trash2 size={11} />
                Delete Comment
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {editor && activeDoc && activeDoc._id === editor.docId ? (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 1000 }}>
          <div style={{ width: "100%", maxWidth: "480px", backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #dbe3ee", boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)", padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>Reject Document</div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>
              {stage === "GRN" ? "Enter the rejection reason for this document." : "Add or edit the rejection comment for this document."}
            </div>
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={4}
              placeholder="Enter rejection reason"
              style={{ width: "100%", padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "11px", color: "#334155", resize: "vertical", outline: "none" }}
            />
            {stage === "GRN" && !draftText.trim() ? (
              <div style={{ fontSize: "10px", color: "#BB0000" }}>A rejection reason is required for GRN documents.</div>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={closeEditor}
                disabled={submitting}
                style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid #d9d9d9", backgroundColor: "#ffffff", color: "#475569", fontSize: "11px", fontWeight: "700", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || (stage === "GRN" && !draftText.trim())}
                style={{ padding: "7px 14px", borderRadius: "8px", border: "none", backgroundColor: "#0070F2", color: "#ffffff", fontSize: "11px", fontWeight: "700", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting || (stage === "GRN" && !draftText.trim()) ? 0.6 : 1 }}
              >
                {submitting ? "Saving..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deletePromptDocId && activeDoc && activeDoc._id === deletePromptDocId ? (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 1000 }}>
          <div style={{ width: "100%", maxWidth: "480px", backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #dbe3ee", boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)", padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>Delete Comment</div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>
              Do you really want to delete this message?
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={closeDeletePrompt}
                disabled={submitting}
                style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid #d9d9d9", backgroundColor: "#ffffff", color: "#475569", fontSize: "11px", fontWeight: "700", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteComment()}
                disabled={submitting}
                style={{ padding: "7px 14px", borderRadius: "8px", border: "none", backgroundColor: "#BB0000", color: "#ffffff", fontSize: "11px", fontWeight: "700", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Upload panel ───────────────────────────────────────────────────────────────

function UploadPanel({
  reference, multiUpload, uploading, onUpload,
}: {
  reference: string; multiUpload: boolean; uploading: boolean;
  onUpload: (files: File[]) => Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const canUpload = files.length > 0 && !uploading;

  return (
    <div style={{ padding: "16px 20px", backgroundColor: "#fafeff", borderTop: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
        <FileUp size={13} color="#0070F2" />
        Upload Document{multiUpload ? "s" : ""}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#64748b" }}>Reference</span>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "#0070F2", padding: "6px 12px", backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px" }}>
            {reference}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: "260px" }}>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#64748b" }}>
            {multiUpload ? "Files" : "File"} (PDF, PNG, JPG, JPEG, TIFF, BMP)
          </span>
          <button type="button" onClick={() => inputRef.current?.click()}
            style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", border: `1.5px dashed ${files.length > 0 ? "#0070F2" : "#cbd5e1"}`, borderRadius: "8px", backgroundColor: files.length > 0 ? "#f0f7ff" : "#f8fafc", cursor: "pointer", fontSize: "12px", color: files.length > 0 ? "#1d4ed8" : "#64748b", fontWeight: files.length > 0 ? "600" : "400", minHeight: "40px", textAlign: "left" }}>
            <Upload size={14} color={files.length > 0 ? "#0070F2" : "#94a3b8"} style={{ flexShrink: 0 }} />
            {files.length > 0 ? files.map((f) => f.name).join(", ") : `Click to choose ${multiUpload ? "one or more files" : "a file"}`}
          </button>
          <input ref={inputRef} type="file" multiple={multiUpload} accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp" style={{ display: "none" }}
            onChange={(e) => setFiles(Array.from(e.target.files || []))} />
        </div>
        <button type="button" disabled={!canUpload}
          onClick={async () => { if (!canUpload) return; await onUpload(files); setFiles([]); if (inputRef.current) inputRef.current.value = ""; }}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 18px", height: "40px", borderRadius: "8px", border: "none", backgroundColor: canUpload ? "#0070F2" : "#e2e8f0", color: canUpload ? "#ffffff" : "#94a3b8", fontSize: "12px", fontWeight: "700", cursor: canUpload ? "pointer" : "not-allowed", flexShrink: 0 }}>
          {uploading ? <LoaderCircle size={14} className="animate-spin" /> : <FileUp size={14} />}
          Upload
        </button>
      </div>
    </div>
  );
}

// ─── Full expanded content ──────────────────────────────────────────────────────

function ExpandedRowContent({
  record, stage, stageKey, docs, docsLoading, subTab, multiUpload, uploading, onUpload, onReview, onComment, onReplace, onDelete,
}: {
  record: ProcurementRecord; stage: Exclude<FrontendStageKey, "INV">; stageKey: StageKey;
  docs: StageDocument[]; docsLoading: boolean; subTab: "upload" | "change" | "view";
  multiUpload: boolean; uploading: boolean;
  onUpload: (ref: string, files: File[]) => Promise<void>;
  onReview: (ref: string, doc: StageDocument, decision: "ACCEPTED" | "REJECTED") => Promise<void>;
  onComment: (ref: string, doc: StageDocument) => Promise<void>;
  onReplace: (ref: string, doc: StageDocument, file: File) => Promise<void>;
  onDelete: (ref: string, doc: StageDocument) => Promise<void>;
}) {
  const reference = getReference(record);

  return (
    <div style={{ backgroundColor: "#f8fbff", borderTop: "2px solid #bfdbfe" }}>
      {/* Items header */}
      <div style={{ padding: "8px 14px", backgroundColor: "#eff6ff", borderBottom: "1px solid #dbeafe", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "11px", fontWeight: "700", color: "#1e40af" }}>Items ({record.items.length})</span>
        <span style={{ fontSize: "10px", color: "#64748b" }}>{getReference(record)}</span>
      </div>

      {/* Items table */}
      <div style={{ overflowX: "auto" }}>
        <ItemsSubTable record={record} stage={stage} />
      </div>

      {/* Documents panel (view & change) */}
      {(subTab === "view" || subTab === "change") && (
        <DocumentsPanel
          reference={reference} stage={stageKey} docs={docs} docsLoading={docsLoading} mode={subTab}
          onReview={onReview} onComment={onComment}
          onReplace={onReplace} onDelete={onDelete}
        />
      )}

      {/* Upload panel (upload tab) */}
      {subTab === "upload" && (
        <UploadPanel
          reference={reference} multiUpload={multiUpload} uploading={uploading}
          onUpload={(files) => onUpload(reference, files)}
        />
      )}
    </div>
  );
}

// ─── Records table ──────────────────────────────────────────────────────────────

function RecordsTable({
  stage, stageKey, records, config, expandedReferences, selectedReference,
  documentsByReference, loadingReferences, subTab, uploading,
  onRowClick, onUpload, onReview, onComment, onReplace, onDelete,
}: {
  stage: Exclude<FrontendStageKey, "INV">; stageKey: StageKey;
  records: ProcurementRecord[]; config: StageModuleConfig;
  expandedReferences: string[]; selectedReference: string;
  documentsByReference: Record<string, StageDocument[]>; loadingReferences: Set<string>;
  subTab: "upload" | "change" | "view"; uploading: boolean;
  onRowClick: (ref: string) => void;
  onUpload: (ref: string, files: File[]) => Promise<void>;
  onReview: (ref: string, doc: StageDocument, decision: "ACCEPTED" | "REJECTED") => Promise<void>;
  onComment: (ref: string, doc: StageDocument) => Promise<void>;
  onReplace: (ref: string, doc: StageDocument, file: File) => Promise<void>;
  onDelete: (ref: string, doc: StageDocument) => Promise<void>;
}) {
  const headers = getHeaders(stage);

  return (
    <div style={{ border: "1px solid #d9d9d9", borderRadius: "12px", overflow: "hidden", backgroundColor: "#ffffff" }}>
      {/* Header bar */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#ffffff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>
          {config.title}s ({records.length})
        </span>
        <span style={{ fontSize: "11px", color: "#94a3b8" }}>Click a row to open its detail page</span>
      </div>

      {/* Scrollable table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: stage === "PR" ? "900px" : stage === "PO" ? "1500px" : "750px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #d9d9d9" }}>
              {headers.map((h) => <th key={h} style={TH}>{h}</th>)}
              <th style={{ ...TH, width: "44px", textAlign: "center", borderRight: "none" }} />
            </tr>
          </thead>

          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={headers.length + 1} style={{ padding: "28px 16px", textAlign: "center", fontSize: "12px", color: "#94a3b8" }}>
                  No records match the selected filters.
                </td>
              </tr>
            ) : records.map((record, idx) => {
              const ref = getReference(record);
              const expanded = expandedReferences.includes(ref);
              const isSelected = selectedReference === ref;
              const docs = documentsByReference[ref] ?? [];
              const docsLoading = loadingReferences.has(ref);
              const rowBg = isSelected ? "#EAF1FF" : idx % 2 === 0 ? "#ffffff" : "#fafafa";

              return (
                <Fragment key={ref}>
                  <tr
                    onClick={() => onRowClick(ref)}
                    style={{ cursor: "pointer", borderBottom: expanded ? "none" : "1px solid #eeeeee", backgroundColor: rowBg }}
                    onMouseEnter={(e) => { if (!isSelected && !expanded) (e.currentTarget as HTMLElement).style.backgroundColor = "#f0f7ff"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = rowBg; }}
                  >
                    <SummaryRowCells record={record} stage={stage} />
                    <td style={{ ...TD, width: "44px", textAlign: "center", borderRight: "none" }}>
                      {expanded ? <ChevronDown size={16} color="#0070F2" /> : <ChevronRight size={16} color="#94a3b8" />}
                    </td>
                  </tr>

                  {expanded && (
                    <tr style={{ borderBottom: "2px solid #bfdbfe" }}>
                      <td colSpan={headers.length + 1} style={{ padding: 0 }}>
                        <ExpandedRowContent
                          record={record} stage={stage} stageKey={stageKey}
                          docs={docs} docsLoading={docsLoading} subTab={subTab}
                          multiUpload={config.multiUpload} uploading={uploading}
                          onUpload={onUpload}
                          onReview={onReview} onComment={onComment} onReplace={onReplace} onDelete={onDelete}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main export ────────────────────────────────────────────────────────────────

export function ProcurementStageModule({ config }: { config: StageModuleConfig }) {
  const stage = getStageFromFrontend(config.frontendStage);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialAction = (searchParams.get("action") as "upload" | "change" | "view" | null) ?? "upload";
  const initialFilters = filtersFromSearchParams(config.frontendStage, searchParams);

  const [filters, setFilters] = useState<FilterValues>(initialFilters);
  const [hasSearched, setHasSearched] = useState(getStageFilterKeys(config.frontendStage).some((key) => initialFilters[key] !== ""));
  const [subTab, setSubTab] = useState<"upload" | "change" | "view">(initialAction);

  const [valueHelpItems, setValueHelpItems] = useState<ValueHelpItem[]>([]);
  const [records, setRecords] = useState<ProcurementRecord[]>([]);
  const [documentsByReference, setDocumentsByReference] = useState<Record<string, StageDocument[]>>({});
  const [loadingReferences, setLoadingReferences] = useState<Set<string>>(new Set());
  const [expandedReferences, setExpandedReferences] = useState<string[]>([]);
  const [selectedReference, setSelectedReference] = useState("");

  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [lastValidation, setLastValidation] = useState<{ ocr_status: string; ocr_rejection_detail?: StageDocument["ocr_rejection_detail"] } | null>(null);

  // ── Load summaries on mount ────────────────────────────────────────────────
  const loadSummaries = async () => {
    setLoading(true);
    setError(null);
    try {
      const [helpers, summaries] = await Promise.all([listValueHelp(config.frontendStage), listStageRecords(stage)]);
      setValueHelpItems(helpers);
      setRecords(summaries as ProcurementRecord[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadSummaries(); }, [config.frontendStage]); // eslint-disable-line

  // ── Sync URL params ────────────────────────────────────────────────────────
  useEffect(() => {
    const nextAction = (searchParams.get("action") as "upload" | "change" | "view" | null) ?? "upload";
    const nextFilters = filtersFromSearchParams(config.frontendStage, searchParams);
    setFilters(nextFilters);
    setSubTab(nextAction);
    setHasSearched(getStageFilterKeys(config.frontendStage).some((key) => nextFilters[key] !== ""));
    setExpandedReferences([]);
    setSelectedReference("");
  }, [config.frontendStage, searchParams]);

  // ── Fetch docs on demand ───────────────────────────────────────────────────
  const fetchDocs = async (ref: string, force = false) => {
    if (!force && documentsByReference[ref] !== undefined) return;
    setLoadingReferences((prev) => new Set(prev).add(ref));
    try {
      const res = await listDocuments(stage, ref);
      const docs = "documents" in res ? res.documents : res.document ? [res.document] : [];
      setDocumentsByReference((prev) => ({ ...prev, [ref]: docs }));
    } catch {
      setDocumentsByReference((prev) => ({ ...prev, [ref]: [] }));
    } finally {
      setLoadingReferences((prev) => { const n = new Set(prev); n.delete(ref); return n; });
    }
  };

  // ── Row click → navigate to standalone detail page ─────────────────────────
  const handleRowClick = (ref: string) => {
    const params = buildListSearchParams(config.frontendStage, subTab, filters);
    navigate(`/documents/${config.frontendStage.toLowerCase()}/${encodeURIComponent(ref)}?${params.toString()}`);
  };

  // ── Filters ────────────────────────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    if (!hasSearched) return [];
    return records.filter((r) => matchesFilters(r, filters, config.frontendStage));
  }, [config.frontendStage, filters, hasSearched, records]);

  const fieldOptions = useMemo(() => buildFieldOptions(records, config.frontendStage), [config.frontendStage, records]);

  const applyFilters = (next: FilterValues) => {
    setFilters(next);
    setHasSearched(true);
    setExpandedReferences([]);
    setSelectedReference("");
    setSearchParams(buildListSearchParams(config.frontendStage, subTab, next), { replace: true });
  };

  // ── Upload (inline expanded rows still work) ───────────────────────────────
  const handleUpload = async (ref: string, files: File[]) => {
    if (!ref || !files.length) return;
    setUploading(true);
    setError(null);
    setInfoMessage(null);
    try {
      const result = await uploadDocuments(stage, ref, files);
      if (stage === "PR") {
        const typed = result as Awaited<ReturnType<typeof uploadDocuments>> & { uploaded?: Array<{ ocr_status: string; ocr_rejection_detail?: StageDocument["ocr_rejection_detail"] }>; uploaded_count?: number };
        setLastValidation(null);
        setInfoMessage(`${typed.uploaded_count ?? 0} document(s) uploaded successfully.`);
      } else {
        const typed = result as StageDocument;
        setLastValidation({ ocr_status: typed.ocr_status, ocr_rejection_detail: typed.ocr_rejection_detail });
        setInfoMessage(`${config.title} document uploaded successfully.`);
      }
      await fetchDocs(ref, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleReview = async (ref: string, doc: StageDocument, decision: "ACCEPTED" | "REJECTED", comment?: string) => {
    setError(null);
    const cleanComment = (comment || "").trim();
    if (decision === "REJECTED" && stage === "GRN" && !cleanComment) {
      setError("GRN rejection requires a reason.");
      return;
    }

    try {
      const updated = await reviewDocument(stage, ref, doc._id, decision, cleanComment || undefined);
      setDocumentsByReference((prev) => ({
        ...prev,
        [ref]: (prev[ref] || []).map((item) => (item._id === updated._id ? updated : item)),
      }));
      setInfoMessage(`${config.title} document ${decision === "ACCEPTED" ? "approved" : "rejected"} successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update document review status.");
    }
  };

  const handleComment = async (ref: string, doc: StageDocument, comment?: string) => {
    setError(null);
    try {
      const cleanComment = (comment || "").trim();
      const updated = await commentDocument(stage, ref, doc._id, cleanComment || undefined);
      setDocumentsByReference((prev) => ({
        ...prev,
        [ref]: (prev[ref] || []).map((item) => (item._id === updated._id ? updated : item)),
      }));
      setInfoMessage(`Comment ${cleanComment ? "saved" : "cleared"} successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save document comment.");
    }
  };

  const handleReplace = async (ref: string, doc: StageDocument, file: File) => {
    setError(null);
    try {
      const updated = await replaceDocument(stage, ref, doc._id, file);
      setDocumentsByReference((prev) => ({
        ...prev,
        [ref]: (prev[ref] || []).map((item) => (item._id === doc._id ? updated : item)),
      }));
      setInfoMessage(`${config.title} document replaced successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to replace document.");
    }
  };

  const handleDelete = async (ref: string, doc: StageDocument) => {
    setError(null);
    try {
      await deleteDocument(stage, doc._id);
      setDocumentsByReference((prev) => ({
        ...prev,
        [ref]: (prev[ref] || []).filter((item) => item._id !== doc._id),
      }));
      setInfoMessage(`${config.title} document deleted successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete document.");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: "8px", color: "#6A6D70", fontSize: "13px" }}>
        <LoaderCircle className="animate-spin" size={18} />
        Loading {config.title.toLowerCase()} data…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <FilterBar
        docType={config.frontendStage}
        actionLabel={subTab === "upload" ? config.uploadLabel : subTab === "change" ? config.changeLabel : config.viewLabel}
        onSearch={applyFilters}
        valueHelpItems={valueHelpItems}
        values={filters}
        fieldOptions={fieldOptions}
      />

      {/* Scrollable content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {!hasSearched ? (
            <SelectionPlaceholder
              title={`Use Go to load ${config.title.toLowerCase()} records`}
              description="Leave all fields blank and press Go to display every record, or enter filters to narrow results."
            />
          ) : (
            <RecordsTable
              stage={config.frontendStage}
              stageKey={stage}
              records={filteredRecords}
              config={config}
              expandedReferences={expandedReferences}
              selectedReference={selectedReference}
              documentsByReference={documentsByReference}
              loadingReferences={loadingReferences}
              subTab={subTab}
              uploading={uploading}
              onRowClick={handleRowClick}
              onUpload={handleUpload}
              onReview={handleReview}
              onComment={handleComment}
              onReplace={handleReplace}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>
      <ModuleFooterAlerts
        error={error}
        infoMessage={infoMessage}
        validation={lastValidation}
      />
    </div>
  );
}
