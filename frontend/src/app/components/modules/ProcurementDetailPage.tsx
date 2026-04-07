import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import {
  ArrowLeft,
  Download,
  Edit,
  FileUp,
  LoaderCircle,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import {
  commentDocument,
  deleteDocument,
  getDocumentDownloadUrl,
  getStageFromFrontend,
  getStageRecord,
  listDocuments,
  replaceDocument,
  reviewDocument,
  uploadDocuments,
} from "../../lib/api";
import { formatCurrency, formatDate } from "../../lib/format";
import type {
  FrontendStageKey,
  GRNRecord,
  PORecord,
  PRRecord,
  StageDocument,
  StageKey,
} from "../../lib/types";

// ─── Types ──────────────────────────────────────────────────────────────────────

type ProcurementRecord = PRRecord | PORecord | GRNRecord;

function isPRRecord(r: ProcurementRecord): r is PRRecord {
  return "pr_number" in r && "document_type" in r && !("po_number" in r) && !("grn_number" in r);
}
function isPORecord(r: ProcurementRecord): r is PORecord {
  return "po_number" in r && "vendor" in r && "company_code" in r && !("grn_number" in r);
}
function isGRNRecord(r: ProcurementRecord): r is GRNRecord {
  return "grn_number" in r && "document_date" in r && "posting_date" in r;
}
function getTotalValue(r: ProcurementRecord) {
  if (isPRRecord(r)) return r.items.reduce((s, i) => s + i.amount, 0);
  if (isPORecord(r)) return r.items.reduce((s, i) => s + i.amount, 0);
  return r.items.reduce((s, i) => s + i.amount, 0);
}

// ─── Styles ──────────────────────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: "12px",
  fontWeight: "700",
  color: "#475569",
  borderBottom: "1px solid #e2e8f0",
  borderRight: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
  backgroundColor: "#f8fafc",
  textAlign: "left",
};
const TD: React.CSSProperties = {
  padding: "13px 16px",
  fontSize: "13px",
  color: "#334155",
  borderBottom: "1px solid #f1f5f9",
  borderRight: "1px solid #f1f5f9",
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

// ─── Stage meta ──────────────────────────────────────────────────────────────────

const SAP_BLUE = "#0070F2";
const FILE_ACCEPT_BY_STAGE: Record<Exclude<FrontendStageKey, "INV">, string> = {
  PR: ".pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.doc,.docx,.xls,.xlsx,.csv,.txt",
  PO: ".pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp",
  GRN: ".pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp",
};
const FILE_LABEL_BY_STAGE: Record<Exclude<FrontendStageKey, "INV">, string> = {
  PR: "PDF, image, DOC, DOCX, XLS, XLSX, CSV, TXT",
  PO: "PDF and image files only",
  GRN: "PDF and image files only",
};

const STAGE_META: Record<Exclude<FrontendStageKey, "INV">, {
  label: string;
  backLabel: string;
  color: string;
}> = {
  PR: {
    label: "Purchase Requisition",
    backLabel: "Purchase Requisitions",
    color: SAP_BLUE,
  },
  PO: {
    label: "Purchase Order",
    backLabel: "Purchase Orders",
    color: SAP_BLUE,
  },
  GRN: {
    label: "Goods Receipt Note",
    backLabel: "Goods Receipt Notes",
    color: SAP_BLUE,
  },
};

// ─── Sub-components ──────────────────────────────────────────────────────────────

function StatusBadge({ text }: { text: string }) {
  const lower = text.toLowerCase();
  const isGreen = lower.includes("open") || lower.includes("follow") || lower.includes("created") || lower.includes("posted");
  return (
    <span style={{
      fontSize: "11px",
      fontWeight: "700",
      color: isGreen ? "#107E3E" : "#6A6D70",
      backgroundColor: isGreen ? "#eef5ec" : "#f5f5f5",
      padding: "3px 10px",
      borderRadius: "6px",
      display: "inline-block",
    }}>
      {text}
    </span>
  );
}

function ReviewBadge({ status }: { status: StageDocument["review_status"] }) {
  const tone =
    status === "ACCEPTED"
      ? { color: "#107E3E", bg: "#EEF5EC" }
      : status === "REJECTED"
        ? { color: "#BB0000", bg: "#FBEAEA" }
        : { color: "#E9730C", bg: "#FEF3E8" };
  return (
    <span style={{ fontSize: "11px", fontWeight: "700", color: tone.color, backgroundColor: tone.bg, padding: "3px 10px", borderRadius: "6px", display: "inline-block" }}>
      {status}
    </span>
  );
}

// ─── Items tables ────────────────────────────────────────────────────────────────

function PRItemsTable({ record }: { record: PRRecord }) {
  const cols = ["Item Number", "Material", "Material Description", "Plant", "Quantity", "Price", "Amount", "Purchase Organization"];
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "960px" }}>
        <thead>
          <tr>{cols.map((c) => <th key={c} style={TH}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {record.items.map((item, i) => (
            <tr key={item.item_number} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#fafcff" }}>
              <td style={TD}>{item.item_number || "—"}</td>
              <td style={{ ...TD, color: "#0070F2", fontWeight: "600" }}>{item.material || "—"}</td>
              <td style={TD}>{item.material_description || "—"}</td>
              <td style={TD}>{item.plant}</td>
              <td style={{ ...TD, textAlign: "right" }}>{item.quantity.toLocaleString()}</td>
              <td style={{ ...TD, textAlign: "right" }}>{formatCurrency(item.price)}</td>
              <td style={{ ...TD, textAlign: "right", fontWeight: "600" }}>{formatCurrency(item.amount)}</td>
              <td style={{ ...TD, borderRight: "none" }}>{item.purchase_organization || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function POItemsTable({ record }: { record: PORecord }) {
  const cols = ["Item Number", "Material", "Material Description", "Quantity", "Price", "Amount", "Plant"];
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "900px" }}>
        <thead>
          <tr>{cols.map((c) => <th key={c} style={TH}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {record.items.map((item, i) => (
            <tr key={item.item_number} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#fafcff" }}>
              <td style={TD}>{item.item_number || "—"}</td>
              <td style={{ ...TD, color: "#107E3E", fontWeight: "600" }}>{item.material}</td>
              <td style={TD}>{item.material_description || "—"}</td>
              <td style={{ ...TD, textAlign: "right" }}>{item.quantity.toLocaleString()}</td>
              <td style={{ ...TD, textAlign: "right" }}>{formatCurrency(item.price)}</td>
              <td style={{ ...TD, textAlign: "right", fontWeight: "600" }}>{formatCurrency(item.amount)}</td>
              <td style={{ ...TD, borderRight: "none" }}>{item.plant}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GRNItemsTable({ record }: { record: GRNRecord }) {
  const cols = ["Item Number", "Material", "Material Description", "Quantity", "Price", "Amount", "Plant", "Purchase Order"];
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "1000px" }}>
        <thead>
          <tr>{cols.map((c) => <th key={c} style={TH}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {record.items.map((item, i) => (
            <tr key={item.item_number} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#fafcff" }}>
              <td style={TD}>{item.item_number || "—"}</td>
              <td style={{ ...TD, color: "#E9730C", fontWeight: "600" }}>{item.material}</td>
              <td style={TD}>{item.material_description || "—"}</td>
              <td style={{ ...TD, textAlign: "right" }}>{item.quantity.toLocaleString()}</td>
              <td style={{ ...TD, textAlign: "right" }}>{formatCurrency(item.price)}</td>
              <td style={{ ...TD, textAlign: "right", fontWeight: "600" }}>{formatCurrency(item.amount)}</td>
              <td style={TD}>{item.plant}</td>
              <td style={{ ...TD, color: "#0070F2", borderRight: "none" }}>{item.purchase_order || record.po_number}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ItemsTable({ record }: { record: ProcurementRecord }) {
  if (isPRRecord(record)) return <PRItemsTable record={record} />;
  if (isPORecord(record)) return <POItemsTable record={record} />;
  if (isGRNRecord(record)) return <GRNItemsTable record={record} />;
  return null;
}

// ─── Documents panel ─────────────────────────────────────────────────────────────

function DocumentsPanel({
  reference,
  stageKey,
  docs,
  docsLoading,
  mode,
  selectedDocumentId,
  onSelectDocument,
  onReview,
  onComment,
  onReplace,
  onDelete,
}: {
  reference: string;
  stageKey: StageKey;
  docs: StageDocument[];
  docsLoading: boolean;
  mode: "change" | "view";
  selectedDocumentId: string | null;
  onSelectDocument: (docId: string) => void;
  onReview: (doc: StageDocument, decision: "ACCEPTED" | "REJECTED", comment?: string) => Promise<void>;
  onComment: (doc: StageDocument, comment?: string) => Promise<void>;
  onReplace: (doc: StageDocument, file: File) => Promise<void>;
  onDelete: (doc: StageDocument) => Promise<void>;
}) {
  const [editor, setEditor] = useState<{ mode: "reject"; docId: string } | null>(null);
  const [deletePromptDocId, setDeletePromptDocId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const activeDoc = docs.find((doc) => doc._id === selectedDocumentId) || docs[0] || null;

  const openEditor = (mode: "reject", doc: StageDocument) => {
    onSelectDocument(doc._id);
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
      await onComment(activeDoc, undefined);
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
    if (stageKey === "GRN" && !cleanText) return;

    setSubmitting(true);
    try {
      await onComment(doc, cleanText || undefined);
      await onReview(doc, "REJECTED", undefined);
      closeEditor();
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplaceClick = (doc: StageDocument) => {
    onSelectDocument(doc._id);
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
      await onReplace(doc, file);
    } finally {
      setBusyDocId(null);
    }
  };

  const handleDeleteClick = async (doc: StageDocument) => {
    onSelectDocument(doc._id);
    const confirmed = window.confirm(`Delete "${doc.original_filename}" from ${reference}?`);
    if (!confirmed) return;
    setBusyDocId(doc._id);
    try {
      await onDelete(doc);
    } finally {
      setBusyDocId(null);
    }
  };

  return (
    <div style={{ borderTop: "1px solid #e0edff" }}>
      <input
        ref={replaceInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.doc,.docx,.xls,.xlsx,.csv,.txt"
        style={{ display: "none" }}
        onChange={(event) => void handleReplaceChange(event)}
      />
      <div style={{
        padding: "10px 24px",
        backgroundColor: "#f0f7ff",
        borderBottom: "1px solid #dbeafe",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Paperclip size={13} color="#1d4ed8" />
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#1e40af" }}>
            Uploaded Documents ({docsLoading ? "…" : docs.length})
          </span>
        </div>
      </div>

      {docsLoading ? (
        <div style={{ padding: "20px 24px", fontSize: "13px", color: "#6A6D70", display: "flex", alignItems: "center", gap: "8px" }}>
          <LoaderCircle size={15} className="animate-spin" /> Loading documents…
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "900px" }}>
            <thead>
              <tr>
                {["File Name", "Reference", "Version", "Upload Date", "Decision", "Actions"].map((c) => (
                  <th key={c} style={TH}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "24px", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>
                    No documents uploaded for <strong>{reference}</strong>.
                  </td>
                </tr>
              ) : docs.map((doc, i) => (
                <tr key={doc._id} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#fafcff" }}>
                  <td style={{ ...TD, minWidth: "240px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <a
                        href={getDocumentDownloadUrl(stageKey, doc._id, true)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => onSelectDocument(doc._id)}
                        style={{ color: "#0070F2", fontWeight: "600", textDecoration: "none", cursor: "pointer" }}
                      >
                        {doc.original_filename}
                      </a>
                      <a
                        href={getDocumentDownloadUrl(stageKey, doc._id)}
                        aria-label={`Download ${doc.original_filename}`}
                        style={{ color: "#64748b", display: "inline-flex", alignItems: "center", cursor: "pointer" }}
                      >
                        <Download size={14} />
                      </a>
                    </div>
                  </td>
                  <td style={TD}>{reference}</td>
                  <td style={TD}>v{doc.version}</td>
                  <td style={TD}>{formatDate(doc.uploaded_at)}</td>
                  <td style={TD}><ReviewBadge status={doc.review_status} /></td>
                  <td style={{ ...TD, borderRight: "none" }}>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => void onReview(doc, "ACCEPTED")}
                        disabled={busyDocId === doc._id}
                        style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 10px", border: "1px solid #107E3E", color: "#107E3E", borderRadius: "7px", fontSize: "11px", fontWeight: "600", backgroundColor: "#ffffff", cursor: "pointer" }}
                      >
                        <span style={{ color: "#107E3E", fontSize: "12px", fontWeight: "800", lineHeight: 1 }}>✓</span>
                        Approve
                      </button>
                      <button
                        onClick={() => openEditor("reject", doc)}
                        disabled={busyDocId === doc._id}
                        style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 10px", border: "1px solid #BB0000", color: "#BB0000", borderRadius: "7px", fontSize: "11px", fontWeight: "600", backgroundColor: "#ffffff", cursor: "pointer" }}
                      >
                        <span style={{ color: "#BB0000", fontSize: "12px", fontWeight: "800", lineHeight: 1 }}>X</span>
                        Reject
                      </button>
                      {mode === "change" ? (
                        <>
                          <button
                            onClick={() => handleReplaceClick(doc)}
                            disabled={busyDocId === doc._id}
                            style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 10px", border: "1px solid #0070F2", color: "#0070F2", borderRadius: "7px", fontSize: "11px", fontWeight: "600", backgroundColor: "#ffffff", cursor: "pointer" }}
                          >
                            {busyDocId === doc._id ? "Working..." : "Replace"}
                          </button>
                          <button
                            onClick={() => void handleDeleteClick(doc)}
                            disabled={busyDocId === doc._id}
                            style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 10px", border: "1px solid #64748b", color: "#64748b", borderRadius: "7px", fontSize: "11px", fontWeight: "600", backgroundColor: "#ffffff", cursor: "pointer" }}
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
        <div style={{ borderTop: "1px solid #e2e8f0", backgroundColor: "#fbfdff", padding: "18px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a", textAlign: "center" }}>Rejected Comment</div>
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", textAlign: "center" }}>{activeDoc.original_filename}</div>
            </div>
          </div>

          {activeDoc.review_status === "REJECTED" ? (
            <div style={{ width: "100%", maxWidth: "620px", margin: "0 auto", padding: "12px 14px", border: "1px solid #fde68a", borderRadius: "10px", backgroundColor: "#fffdf5" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <div style={{ fontSize: "11px", fontWeight: "700", color: "#b45309" }}>Comment</div>
                <button
                  type="button"
                  onClick={() => openEditor("reject", activeDoc)}
                  style={{ display: "flex", alignItems: "center", gap: "4px", border: "none", backgroundColor: "transparent", color: "#0070F2", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}
                >
                  <Edit size={12} />
                  Edit Comment
                </button>
              </div>
              <div style={{ fontSize: "12px", color: "#334155", whiteSpace: "pre-wrap", marginTop: "6px" }}>
                {activeDoc.attachment_comment || activeDoc.review_comment || "No rejection comment added."}
              </div>
              <button
                type="button"
                onClick={() => setDeletePromptDocId(activeDoc._id)}
                style={{ display: "flex", alignItems: "center", gap: "4px", border: "none", backgroundColor: "transparent", color: "#BB0000", fontSize: "11px", fontWeight: "700", cursor: "pointer", marginTop: "10px", marginLeft: "auto" }}
              >
                <Trash2 size={12} />
                Delete Comment
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {editor && activeDoc && activeDoc._id === editor.docId ? (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 1000 }}>
          <div style={{ width: "100%", maxWidth: "520px", backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #dbe3ee", boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)", padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>Reject Document</div>
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              {stageKey === "GRN" ? "Enter the rejection reason for this document." : "Add or edit the rejection comment for this document."}
            </div>
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={5}
              placeholder="Enter rejection reason"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "12px", color: "#334155", resize: "vertical", outline: "none" }}
            />
            {stageKey === "GRN" && !draftText.trim() ? (
              <div style={{ fontSize: "11px", color: "#BB0000" }}>A rejection reason is required for GRN documents.</div>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={closeEditor}
                disabled={submitting}
                style={{ padding: "8px 14px", borderRadius: "9px", border: "1px solid #d9d9d9", backgroundColor: "#ffffff", color: "#475569", fontSize: "12px", fontWeight: "700", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || (stageKey === "GRN" && !draftText.trim())}
                style={{ padding: "8px 16px", borderRadius: "9px", border: "none", backgroundColor: "#0070F2", color: "#ffffff", fontSize: "12px", fontWeight: "700", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting || (stageKey === "GRN" && !draftText.trim()) ? 0.6 : 1 }}
              >
                {submitting ? "Saving..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deletePromptDocId && activeDoc && activeDoc._id === deletePromptDocId ? (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 1000 }}>
          <div style={{ width: "100%", maxWidth: "520px", backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #dbe3ee", boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)", padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>Delete Comment</div>
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              Do you really want to delete this message?
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={closeDeletePrompt}
                disabled={submitting}
                style={{ padding: "8px 14px", borderRadius: "9px", border: "1px solid #d9d9d9", backgroundColor: "#ffffff", color: "#475569", fontSize: "12px", fontWeight: "700", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteComment()}
                disabled={submitting}
                style={{ padding: "8px 16px", borderRadius: "9px", border: "none", backgroundColor: "#BB0000", color: "#ffffff", fontSize: "12px", fontWeight: "700", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}
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

// ─── Upload panel ────────────────────────────────────────────────────────────────

function UploadPanel({
  reference,
  stage,
  multiUpload,
  uploading,
  onUpload,
}: {
  reference: string;
  stage: Exclude<FrontendStageKey, "INV">;
  multiUpload: boolean;
  uploading: boolean;
  onUpload: (files: File[]) => Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const canUpload = files.length > 0 && !uploading;

  return (
    <div style={{ padding: "20px 24px", backgroundColor: "#fafeff", borderTop: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a", marginBottom: "14px", display: "flex", alignItems: "center", gap: "7px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <FileUp size={15} color="#0070F2" />
          Upload Document{multiUpload ? "s" : ""}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "14px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748b" }}>Reference</span>
          <div style={{ fontSize: "13px", fontWeight: "700", color: "#0070F2", padding: "8px 14px", backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px" }}>
            {reference}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: 1, minWidth: "280px" }}>
          <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748b" }}>
            {multiUpload ? "Files" : "File"} ({FILE_LABEL_BY_STAGE[stage]})
          </span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 16px",
              border: `1.5px dashed ${files.length > 0 ? "#0070F2" : "#cbd5e1"}`,
              borderRadius: "10px",
              backgroundColor: files.length > 0 ? "#f0f7ff" : "#f8fafc",
              cursor: "pointer",
              fontSize: "13px",
              color: files.length > 0 ? "#1d4ed8" : "#64748b",
              fontWeight: files.length > 0 ? "600" : "400",
              minHeight: "44px",
              textAlign: "left",
            }}
          >
            <Upload size={15} color={files.length > 0 ? "#0070F2" : "#94a3b8"} style={{ flexShrink: 0 }} />
            {files.length > 0 ? files.map((f) => f.name).join(", ") : `Click to choose ${multiUpload ? "one or more files" : "a file"}`}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple={multiUpload}
            accept={FILE_ACCEPT_BY_STAGE[stage]}
            style={{ display: "none" }}
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
        </div>
        <button
          type="button"
          disabled={!canUpload}
          onClick={async () => {
            if (!canUpload) return;
            await onUpload(files);
            setFiles([]);
            if (inputRef.current) inputRef.current.value = "";
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            padding: "10px 22px",
            height: "44px",
            borderRadius: "10px",
            border: "none",
            backgroundColor: canUpload ? "#0070F2" : "#e2e8f0",
            color: canUpload ? "#ffffff" : "#94a3b8",
            fontSize: "13px",
            fontWeight: "700",
            cursor: canUpload ? "pointer" : "not-allowed",
            flexShrink: 0,
          }}
        >
          {uploading ? <LoaderCircle size={15} className="animate-spin" /> : <FileUp size={15} />}
          Upload
        </button>
      </div>
    </div>
  );
}

// ─── Alert bar ───────────────────────────────────────────────────────────────────

function AlertBar({ error, info }: { error?: string | null; info?: string | null }) {
  if (!error && !info) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {error && (
        <div style={{ padding: "12px 16px", backgroundColor: "#FBEAEA", border: "1px solid #F0B2B2", borderRadius: "10px", fontSize: "13px", color: "#BB0000", fontWeight: "500" }}>
          {error}
        </div>
      )}
      {info && (
        <div style={{ padding: "12px 16px", backgroundColor: "#EEF5EC", border: "1px solid #B7E0C1", borderRadius: "10px", fontSize: "13px", color: "#107E3E", fontWeight: "500" }}>
          {info}
        </div>
      )}
    </div>
  );
}

// ─── Main page component ─────────────────────────────────────────────────────────

export function ProcurementDetailPage() {
  const { ref: refParam } = useParams<{ ref: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Derive the stage from the URL path segment: /documents/pr/..., /documents/po/..., /documents/grn/...
  const pathSegment = location.pathname.split("/").filter(Boolean)[1]?.toUpperCase() as Exclude<FrontendStageKey, "INV"> | undefined;
  const frontendStage: Exclude<FrontendStageKey, "INV"> =
    pathSegment === "PO" ? "PO" : pathSegment === "GRN" ? "GRN" : "PR";
  const docRef = refParam ?? "";
  const subTab = (searchParams.get("action") as "upload" | "change" | "view" | null) ?? "view";
  const stageKey: StageKey = getStageFromFrontend(frontendStage);
  const meta = STAGE_META[frontendStage] ?? STAGE_META.PR;
  const multiUpload = frontendStage === "PR";

  const [record, setRecord] = useState<ProcurementRecord | null>(null);
  const [docs, setDocs] = useState<StageDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(subTab === "upload" || subTab === "view" || subTab === "change" ? "Attachment" : "Items");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const itemsSectionRef = useRef<HTMLDivElement>(null);
  const attachmentsSectionRef = useRef<HTMLDivElement>(null);

  const loadRecord = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getStageRecord(stageKey, docRef);
      setRecord(result as ProcurementRecord);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load record.");
    } finally {
      setLoading(false);
    }
  };

  const loadDocs = async (force = false) => {
    if (!force && docs.length > 0) return;
    setDocsLoading(true);
    try {
      const res = await listDocuments(stageKey, docRef);
      const list = "documents" in res ? res.documents : res.document ? [res.document] : [];
      setDocs(list as StageDocument[]);
      setSelectedDocumentId((current) => {
        if (current && list.some((doc: StageDocument) => doc._id === current)) return current;
        return list[0]?._id ?? null;
      });
    } catch {
      setDocs([]);
      setSelectedDocumentId(null);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    if (!docRef) return;
    void loadRecord();
    void loadDocs();
  }, [docRef, stageKey]); // eslint-disable-line

  useEffect(() => {
    if (subTab === "upload" || subTab === "view" || subTab === "change") {
      setActiveTab("Attachment");
      setTimeout(() => attachmentsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
  }, [subTab]);

  const handleUpload = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    setError(null);
    setInfoMessage(null);
    try {
      await uploadDocuments(stageKey, docRef, files);
      setInfoMessage(`${files.length} document(s) uploaded successfully.`);
      await loadDocs(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const goBack = () => {
    const next = new URLSearchParams(searchParams);
    if (!next.get("tab")) next.set("tab", frontendStage);
    navigate(`/documents?${next.toString()}`);
  };

  const goToSection = (section: "Items" | "Attachment") => {
    setActiveTab(section);
    const target = section === "Items" ? itemsSectionRef.current : attachmentsSectionRef.current;
    const container = scrollAreaRef.current;
    if (target && container) {
      const top = target.offsetTop - 120;
      container.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
      return;
    }
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── Breadcrumb ──
  const breadcrumb = `Home › Document Verification › ${meta.label}`;

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Page header */}
        <div style={{ padding: "12px 24px", borderBottom: "1px solid #d9d9d9", backgroundColor: "#ffffff", flexShrink: 0 }}>
          <div style={{ fontSize: "11px", color: "#8a8b8c" }}>{breadcrumb}</div>
          <h1 style={{ fontSize: "16px", fontWeight: "700", color: "#32363a", margin: "2px 0 0" }}>Loading…</h1>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", color: "#6A6D70", fontSize: "14px" }}>
          <LoaderCircle size={20} className="animate-spin" />
          Loading {meta.label.toLowerCase()}…
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ padding: "12px 24px", borderBottom: "1px solid #d9d9d9", backgroundColor: "#ffffff", flexShrink: 0 }}>
          <div style={{ fontSize: "11px", color: "#8a8b8c" }}>{breadcrumb}</div>
          <h1 style={{ fontSize: "16px", fontWeight: "700", color: "#32363a", margin: "2px 0 0" }}>Not Found</h1>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
          <div style={{ fontSize: "14px", color: "#0f172a", fontWeight: "600" }}>Record not found</div>
          <div style={{ fontSize: "12px", color: "#8a8b8c" }}>Could not find {frontendStage} record: {docRef}</div>
          <button onClick={goBack} style={{ padding: "8px 18px", borderRadius: "8px", border: "none", backgroundColor: "#0070F2", color: "#ffffff", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const totalValue = getTotalValue(record);
  const attachmentCount = docs.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div ref={scrollAreaRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", backgroundColor: "#f1f5f9" }}>
        <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1600px" }}>

          {/* ── Hero header card ─────────────────────────────────────── */}
          <div style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "20px",
            overflow: "hidden",
            boxShadow: "0 2px 8px rgba(15,23,42,0.07)",
          }}>
            {/* Top stripe with back + title */}
            <div style={{
              padding: "20px 32px 16px",
              borderBottom: "1px solid #f1f5f9",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}>
              <button
                onClick={goBack}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 12px 5px 8px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  backgroundColor: "#f8fafc",
                  color: "#475569",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  width: "fit-content",
                }}
              >
                <ArrowLeft size={14} color="#64748b" />
                Back to {meta.backLabel}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                <div style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a", letterSpacing: "-0.5px" }}>
                  {docRef}
                </div>
                <StatusBadge text={record.status || "Open"} />
              </div>
            </div>
            {/* Tab strip */}
            <div style={{ padding: "0 32px", display: "flex", alignItems: "center", gap: "0" }}>
              {[`Items (${record.items.length})`, `Attachments (${attachmentCount})`].map((tabLabel, index) => {
                const tab = index === 0 ? "Items" : "Attachment";
                return (
                <button
                  key={tabLabel}
                  onClick={() => goToSection(tab)}
                  style={{
                    padding: "14px 20px",
                    fontSize: "13px",
                    fontWeight: activeTab === tab ? "700" : "500",
                    color: activeTab === tab ? meta.color : "#64748b",
                    backgroundColor: "transparent",
                    border: "none",
                    borderBottom: activeTab === tab ? `2.5px solid ${meta.color}` : "2.5px solid transparent",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tabLabel}
                </button>
              )})}
            </div>
          </div>

          <AlertBar error={error} info={infoMessage} />

          <div
            ref={itemsSectionRef}
            style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}
          >
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>Items ({record.items.length})</div>
              <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "500" }}>Total: {formatCurrency(totalValue)}</div>
            </div>
            <div>
              <ItemsTable record={record} />
            </div>
          </div>

          <div
            ref={attachmentsSectionRef}
            style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}
          >
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>Attachments ({attachmentCount})</div>
            </div>
            <div>
              {(subTab === "view" || subTab === "change") && (
                <DocumentsPanel
                  reference={docRef}
                  stageKey={stageKey}
                  docs={docs}
                  docsLoading={docsLoading}
                  mode={subTab}
                  selectedDocumentId={selectedDocumentId}
                  onSelectDocument={setSelectedDocumentId}
                  onReview={async (doc, decision, comment) => {
                    setError(null);
                    const cleanComment = (comment || "").trim();
                    if (decision === "REJECTED" && stageKey === "GRN" && !cleanComment) {
                      setError("GRN rejection requires a reason.");
                      return;
                    }

                    try {
                      const updated = await reviewDocument(stageKey, docRef, doc._id, decision, cleanComment || undefined);
                      setDocs((current) => current.map((item) => (item._id === updated._id ? updated : item)));
                      setSelectedDocumentId(updated._id);
                      setInfoMessage(`${stageKey} document ${decision === "ACCEPTED" ? "approved" : "rejected"} successfully.`);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Unable to update document review status.");
                    }
                  }}
                  onComment={async (doc, comment) => {
                    setError(null);
                    try {
                      const updated = await commentDocument(stageKey, docRef, doc._id, (comment || "").trim() || undefined);
                      setDocs((current) => current.map((item) => (item._id === updated._id ? updated : item)));
                      setSelectedDocumentId(updated._id);
                      setInfoMessage(`Comment ${(comment || "").trim() ? "saved" : "cleared"} successfully.`);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Unable to save document comment.");
                    }
                  }}
                  onReplace={async (doc, file) => {
                    setError(null);
                    try {
                      const updated = await replaceDocument(stageKey, docRef, doc._id, file);
                      setDocs((current) => current.map((item) => (item._id === doc._id ? updated : item)));
                      setSelectedDocumentId(updated._id);
                      setInfoMessage(`${stageKey} document replaced successfully.`);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Unable to replace document.");
                    }
                  }}
                  onDelete={async (doc) => {
                    setError(null);
                    try {
                      await deleteDocument(stageKey, doc._id);
                      setDocs((current) => current.filter((item) => item._id !== doc._id));
                      setSelectedDocumentId((current) => (current === doc._id ? null : current));
                      setInfoMessage(`${stageKey} document deleted successfully.`);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Unable to delete document.");
                    }
                  }}
                />
              )}
              {subTab === "upload" && (
                <UploadPanel
                  reference={docRef}
                  stage={frontendStage}
                  multiUpload={multiUpload}
                  uploading={uploading}
                  onUpload={handleUpload}
                />
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
