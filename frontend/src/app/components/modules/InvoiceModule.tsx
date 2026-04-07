import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Download, Edit, LoaderCircle, Paperclip, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router";
import { FilterBar, createEmptyFilterValues, type FilterValues } from "../FilterBar";
import { commentDocument, getDocumentDownloadUrl, getStageRecord, listDocuments, listStageRecords, listValueHelp, reviewDocument } from "../../lib/api";
import { formatCurrency, formatDate } from "../../lib/format";
import { ModuleFooterAlerts, SelectionPlaceholder } from "./ModuleExperience";
import type {
  GRNRecord,
  InvoiceAggregate,
  InvoiceRecord,
  PORecord,
  PRRecord,
  StageDocument,
  StageKey,
  ValueHelpItem,
} from "../../lib/types";

type InvoiceRow = {
  invoiceNumber: string;
  prNumber: string;
  poNumber: string;
  grnNumber: string;
  createdAt: string;
  status: string;
  synthetic?: boolean;
};

const TH_STYLE: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: "12px",
  fontWeight: "700",
  color: "#475569",
  borderBottom: "1px solid #e2e8f0",
  borderRight: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
  backgroundColor: "#f8fafc",
  textAlign: "left",
};

const TD_STYLE: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: "12px",
  color: "#334155",
  borderBottom: "1px solid #f1f5f9",
  borderRight: "1px solid #f1f5f9",
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

function asRows(invoices: InvoiceRecord[]): InvoiceRow[] {
  return invoices.map((invoice) => ({
    invoiceNumber: invoice.invoice_number,
    prNumber: invoice.pr_number,
    poNumber: invoice.po_number,
    grnNumber: invoice.grn_number,
    createdAt: invoice.created_at,
    status: invoice.status,
  }));
}

function statusBadge(status: string, synthetic = false) {
  const normalized = status.toLowerCase();
  const tone = synthetic
    ? { color: "#1d4ed8", bg: "#dbeafe" }
    : normalized.includes("sent")
      ? { color: "#7c2d12", bg: "#ffedd5" }
      : normalized.includes("pending")
        ? { color: "#b45309", bg: "#fef3c7" }
        : { color: "#107E3E", bg: "#eef5ec" };

  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: "700",
        color: tone.color,
        backgroundColor: tone.bg,
        padding: "3px 10px",
        borderRadius: "999px",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      {synthetic ? "Demo linkage" : status}
    </span>
  );
}

function SectionTable({
  title,
  badge,
  children,
  collapsible = false,
  collapsed = false,
  onToggle,
}: {
  title: string;
  badge?: string;
  children: ReactNode;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #f1f5f9",
          backgroundColor: "#fafcff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <span style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>{title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {badge ? <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "500" }}>{badge}</span> : null}
          {collapsible ? (
            <button
              type="button"
              onClick={onToggle}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                border: "1px solid #dbe3ee",
                backgroundColor: "#ffffff",
                color: "#334155",
                borderRadius: "10px",
                padding: "6px 10px",
                fontSize: "11px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              {collapsed ? "Show Table" : "Hide Table"}
            </button>
          ) : null}
        </div>
      </div>
      {collapsed ? null : children}
    </div>
  );
}

function AttachmentSubCard({
  title,
  stage,
  reference,
  docs,
  loading,
  onReview,
  onComment,
}: {
  title: string;
  stage: StageKey;
  reference: string;
  docs: StageDocument[];
  loading: boolean;
  onReview: (stage: "PR" | "PO" | "GRN", reference: string, doc: StageDocument, decision: "ACCEPTED" | "REJECTED", comment?: string) => Promise<void>;
  onComment: (stage: "PR" | "PO" | "GRN", reference: string, doc: StageDocument, comment?: string) => Promise<void>;
}) {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ mode: "reject"; docId: string } | null>(null);
  const [deletePromptDocId, setDeletePromptDocId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
      await onComment(stage as "PR" | "PO" | "GRN", reference, activeDoc, undefined);
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
      await onComment(stage as "PR" | "PO" | "GRN", reference, doc, cleanText || undefined);
      await onReview(stage as "PR" | "PO" | "GRN", reference, doc, "REJECTED");
      closeEditor();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        margin: "16px 20px 20px",
        border: "1px solid #dbeafe",
        borderRadius: "14px",
        overflow: "hidden",
        backgroundColor: "#f8fbff",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #dbeafe",
          backgroundColor: "#eff6ff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Paperclip size={14} color="#1d4ed8" />
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#1e40af" }}>{title}</span>
        </div>
        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>{reference}</span>
      </div>

      {loading ? (
        <div style={{ padding: "16px", display: "flex", alignItems: "center", gap: "8px", color: "#6A6D70", fontSize: "12px" }}>
          <LoaderCircle size={14} className="animate-spin" />
          Loading attachments...
        </div>
      ) : docs.length === 0 ? (
        <div style={{ padding: "16px", fontSize: "12px", color: "#94a3b8" }}>No attachments uploaded for this record.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "860px" }}>
            <thead>
              <tr>
                {["File Name", "Reference", "Version", "Upload Date", "Decision", "Actions"].map((header, index, arr) => (
                  <th
                    key={header}
                    style={{ ...TH_STYLE, fontSize: "11px", backgroundColor: "#f8fbff", borderRight: index === arr.length - 1 ? "none" : TH_STYLE.borderRight }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map((doc, index) => (
                <tr key={doc._id} style={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "#fafcff" }}>
                  <td style={{ ...TD_STYLE, minWidth: "240px" }}>
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
                  <td style={TD_STYLE}>{reference}</td>
                  <td style={TD_STYLE}>v{doc.version}</td>
                  <td style={TD_STYLE}>{formatDate(doc.uploaded_at)}</td>
                  <td style={TD_STYLE}>{doc.review_status}</td>
                  <td style={{ ...TD_STYLE, borderRight: "none" }}>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => void onReview(stage as "PR" | "PO" | "GRN", reference, doc, "ACCEPTED")}
                        style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", color: "#107E3E", backgroundColor: "#ffffff", border: "1px solid #107E3E", borderRadius: "7px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}
                      >
                        <span style={{ color: "#107E3E", fontSize: "12px", fontWeight: "800", lineHeight: 1 }}>✓</span>
                        Approve
                      </button>
                      <button
                        onClick={() => openEditor("reject", doc)}
                        style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", color: "#BB0000", backgroundColor: "#ffffff", border: "1px solid #BB0000", borderRadius: "7px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}
                      >
                        <span style={{ color: "#BB0000", fontSize: "12px", fontWeight: "800", lineHeight: 1 }}>X</span>
                        Reject
                      </button>
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

function DataTable({
  headers,
  emptyMessage,
  children,
}: {
  headers: string[];
  emptyMessage?: string;
  children?: ReactNode;
}) {
  const hasContent = Boolean(children);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "920px" }}>
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th
                key={header}
                style={{ ...TH_STYLE, borderRight: index === headers.length - 1 ? "none" : TH_STYLE.borderRight }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hasContent ? (
            children
          ) : (
            <tr>
              <td colSpan={headers.length} style={{ padding: "22px 16px", textAlign: "center", fontSize: "12px", color: "#94a3b8" }}>
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function matchesInvoiceFilters(row: InvoiceRow, filters: FilterValues) {
  if (filters.search) {
    const haystack = [row.invoiceNumber, row.prNumber, row.poNumber, row.grnNumber].join(" ").toLowerCase();
    if (!haystack.includes(filters.search.toLowerCase())) return false;
  }
  if (filters.docNumber && row.invoiceNumber !== filters.docNumber) return false;
  if (filters.prNumber && row.prNumber !== filters.prNumber) return false;
  if (filters.poNumber && row.poNumber !== filters.poNumber) return false;
  if (filters.grnNumber && row.grnNumber !== filters.grnNumber) return false;
  return true;
}

function buildSyntheticAggregate(filters: FilterValues, prs: PRRecord[], pos: PORecord[], grns: GRNRecord[]): InvoiceAggregate | null {
  const explicitPr = filters.prNumber.trim();
  const explicitPo = filters.poNumber.trim();
  const explicitGrn = filters.grnNumber.trim();

  let pr = explicitPr ? prs.find((item) => item.pr_number === explicitPr) ?? null : null;
  let po = explicitPo ? pos.find((item) => item.po_number === explicitPo) ?? null : null;
  let grn = explicitGrn ? grns.find((item) => item.grn_number === explicitGrn) ?? null : null;

  if (!po && pr) {
    const linkedPr = pr;
    po = pos.find((item) => item.pr_number === linkedPr.pr_number) ?? null;
  }
  if (!grn && po) {
    const linkedPo = po;
    grn = grns.find((item) => item.po_number === linkedPo.po_number) ?? null;
  }
  if (!po && grn) po = pos.find((item) => item.po_number === grn.po_number) ?? null;
  if (!pr && po) pr = prs.find((item) => item.pr_number === po.pr_number) ?? null;
  if (!pr && grn && po) pr = prs.find((item) => item.pr_number === po.pr_number) ?? null;

  if (!pr && !po && !grn) return null;

  const anchor = grn?.grn_number || po?.po_number || pr?.pr_number || "DEMO";
  const now = new Date().toISOString();

  return {
    invoice: {
      _id: `synthetic-${anchor}`,
      invoice_number: `INV-${anchor}`,
      pr_number: pr?.pr_number || "",
      po_number: po?.po_number || "",
      grn_number: grn?.grn_number || "",
      status: "DEMO_LINKED",
      miro_redirect_url: "",
      created_at: now,
      updated_at: now,
    },
    purchase_requisition: pr,
    purchase_order: po,
    goods_receipt: grn,
    uploaded_document: null,
    has_document: false,
    miro_redirect_url: "",
  };
}

function aggregateToRow(aggregate: InvoiceAggregate, synthetic = false): InvoiceRow {
  return {
    invoiceNumber: aggregate.invoice.invoice_number,
    prNumber: aggregate.invoice.pr_number,
    poNumber: aggregate.invoice.po_number,
    grnNumber: aggregate.invoice.grn_number,
    createdAt: aggregate.invoice.created_at,
    status: aggregate.invoice.status,
    synthetic,
  };
}

export function InvoiceModule() {
  const [searchParams] = useSearchParams();
  const initialDocNumber = searchParams.get("doc") || "";

  const [filters, setFilters] = useState<FilterValues>(createEmptyFilterValues({ docNumber: initialDocNumber }));
  const [hasSearched, setHasSearched] = useState(Boolean(initialDocNumber));
  const [valueHelpItems, setValueHelpItems] = useState<ValueHelpItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [prRecords, setPrRecords] = useState<PRRecord[]>([]);
  const [poRecords, setPoRecords] = useState<PORecord[]>([]);
  const [grnRecords, setGrnRecords] = useState<GRNRecord[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<string>(initialDocNumber);
  const [aggregate, setAggregate] = useState<InvoiceAggregate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [linkedDocs, setLinkedDocs] = useState<Record<"PR" | "PO" | "GRN", StageDocument[]>>({ PR: [], PO: [], GRN: [] });
  const [docsLoading, setDocsLoading] = useState<Record<"PR" | "PO" | "GRN", boolean>>({ PR: false, PO: false, GRN: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiddenSections, setHiddenSections] = useState({
    overview: false,
    pr: false,
    po: false,
    grn: false,
  });
  const overviewSectionRef = useRef<HTMLDivElement | null>(null);
  const prSectionRef = useRef<HTMLDivElement | null>(null);
  const poSectionRef = useRef<HTMLDivElement | null>(null);
  const grnSectionRef = useRef<HTMLDivElement | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [helpers, invoiceList, prs, pos, grns] = await Promise.all([
        listValueHelp("INV"),
        listStageRecords("INVOICE"),
        listStageRecords("PR"),
        listStageRecords("PO"),
        listStageRecords("GRN"),
      ]);

      setValueHelpItems(helpers);
      setInvoices(invoiceList as InvoiceRecord[]);
      setPrRecords(prs as PRRecord[]);
      setPoRecords(pos as PORecord[]);
      setGrnRecords(grns as GRNRecord[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load invoice data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const nextDocNumber = searchParams.get("doc") ?? "";
    setFilters(createEmptyFilterValues({ docNumber: nextDocNumber }));
    setHasSearched(Boolean(nextDocNumber));
    setSelectedInvoice(nextDocNumber);
  }, [searchParams]);

  const baseRows = useMemo(() => asRows(invoices), [invoices]);

  const filteredRows = useMemo(() => {
    if (!hasSearched) return [];
    return baseRows.filter((row) => matchesInvoiceFilters(row, filters));
  }, [baseRows, filters, hasSearched]);

  const syntheticAggregate = useMemo(() => {
    if (!hasSearched) return null;
    if (filters.docNumber) return null;
    if (!filters.prNumber && !filters.poNumber && !filters.grnNumber) return null;
    return buildSyntheticAggregate(filters, prRecords, poRecords, grnRecords);
  }, [filters, grnRecords, hasSearched, poRecords, prRecords]);

  const displayRows = useMemo(() => {
    if (!hasSearched) return [];
    if (filteredRows.length > 0) return filteredRows;
    if (syntheticAggregate) return [aggregateToRow(syntheticAggregate, true)];
    return [];
  }, [filteredRows, hasSearched, syntheticAggregate]);

  useEffect(() => {
    if (!hasSearched) {
      setAggregate(null);
      setSelectedInvoice("");
      return;
    }

    if (displayRows.length === 0) {
      setAggregate(null);
      setSelectedInvoice("");
      return;
    }

    const preferredRow =
      displayRows.find((row) => row.invoiceNumber === filters.docNumber) ??
      displayRows.find((row) => row.invoiceNumber === selectedInvoice) ??
      displayRows[0];

    if (preferredRow.synthetic) {
      setSelectedInvoice(preferredRow.invoiceNumber);
      setAggregate(syntheticAggregate);
      setDetailLoading(false);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setSelectedInvoice(preferredRow.invoiceNumber);

    void getStageRecord("INVOICE", preferredRow.invoiceNumber)
      .then((result) => {
        if (!cancelled) setAggregate(result as InvoiceAggregate);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setAggregate(null);
          setError(loadError instanceof Error ? loadError.message : "Unable to load invoice details.");
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [displayRows, filters.docNumber, hasSearched, selectedInvoice, syntheticAggregate]);

  const selectInvoice = async (row: InvoiceRow) => {
    setSelectedInvoice(row.invoiceNumber);
    setFilters((current) => ({ ...current, docNumber: row.synthetic ? "" : row.invoiceNumber }));
    setError(null);

    if (row.synthetic) {
      setAggregate(syntheticAggregate);
      return;
    }

    setDetailLoading(true);
    try {
      setAggregate(await getStageRecord("INVOICE", row.invoiceNumber) as InvoiceAggregate);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load invoice details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const activeAggregate = aggregate;
  const activeInvoice = activeAggregate?.invoice ?? null;
  const usesSyntheticLinkage = activeInvoice?.status === "DEMO_LINKED";

  useEffect(() => {
    if (!activeAggregate || usesSyntheticLinkage) return;

    const invoiceNumber = activeAggregate.invoice.invoice_number;
    let cancelled = false;

    void (async () => {
      let nextPr = activeAggregate.purchase_requisition;
      let nextPo = activeAggregate.purchase_order;
      let nextGrn = activeAggregate.goods_receipt;

      try {
        const grnRef = nextGrn?.grn_number || activeAggregate.invoice.grn_number || "";
        if (!nextGrn && grnRef) {
          nextGrn = await getStageRecord("GRN", grnRef) as GRNRecord;
        }

        const poRef = nextPo?.po_number || nextGrn?.po_number || activeAggregate.invoice.po_number || "";
        if (!nextPo && poRef) {
          nextPo = await getStageRecord("PO", poRef) as PORecord;
        }

        const prRef = nextPr?.pr_number || nextPo?.pr_number || activeAggregate.invoice.pr_number || "";
        if (!nextPr && prRef) {
          nextPr = await getStageRecord("PR", prRef) as PRRecord;
        }
      } catch {
        // Keep the current aggregate when one of the linked lookups is unavailable.
      }

      if (cancelled) return;

      setAggregate((current) => {
        if (!current || current.invoice.invoice_number !== invoiceNumber) return current;
        if (
          current.purchase_requisition === nextPr &&
          current.purchase_order === nextPo &&
          current.goods_receipt === nextGrn
        ) {
          return current;
        }

        return {
          ...current,
          purchase_requisition: nextPr,
          purchase_order: nextPo,
          goods_receipt: nextGrn,
        };
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [activeAggregate, usesSyntheticLinkage]);

  useEffect(() => {
    if (!activeAggregate) {
      setLinkedDocs({ PR: [], PO: [], GRN: [] });
      setDocsLoading({ PR: false, PO: false, GRN: false });
      return;
    }

    const refs: Array<{ key: "PR" | "PO" | "GRN"; reference: string }> = [
      { key: "PR", reference: activeAggregate.purchase_requisition?.pr_number || "" },
      { key: "PO", reference: activeAggregate.purchase_order?.po_number || "" },
      { key: "GRN", reference: activeAggregate.goods_receipt?.grn_number || "" },
    ];

    let cancelled = false;

    refs.forEach(({ key, reference }) => {
      if (!reference) {
        setLinkedDocs((current) => ({ ...current, [key]: [] }));
        setDocsLoading((current) => ({ ...current, [key]: false }));
        return;
      }

      setDocsLoading((current) => ({ ...current, [key]: true }));

      void listDocuments(key, reference)
        .then((result) => {
          if (cancelled) return;
          const docs = "documents" in result ? result.documents : result.document ? [result.document] : [];
          setLinkedDocs((current) => ({ ...current, [key]: docs }));
        })
        .catch(() => {
          if (!cancelled) setLinkedDocs((current) => ({ ...current, [key]: [] }));
        })
        .finally(() => {
          if (!cancelled) setDocsLoading((current) => ({ ...current, [key]: false }));
        });
    });

    return () => {
      cancelled = true;
    };
  }, [activeAggregate]);

  const handleLinkedDocumentReview = async (stage: "PR" | "PO" | "GRN", reference: string, doc: StageDocument, decision: "ACCEPTED" | "REJECTED", comment?: string) => {
    setError(null);
    const cleanComment = (comment || "").trim();
    if (decision === "REJECTED" && stage === "GRN" && !cleanComment) {
      setError("GRN rejection requires a reason.");
      return;
    }

    try {
      const updated = await reviewDocument(stage, reference, doc._id, decision, cleanComment || undefined);
      setLinkedDocs((current) => ({
        ...current,
        [stage]: current[stage].map((item) => (item._id === updated._id ? updated : item)),
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to update document review status.");
    }
  };

  const handleLinkedDocumentComment = async (stage: "PR" | "PO" | "GRN", reference: string, doc: StageDocument, comment?: string) => {
    setError(null);
    try {
      const cleanComment = (comment || "").trim();
      const updated = await commentDocument(stage, reference, doc._id, cleanComment || undefined);
      setLinkedDocs((current) => ({
        ...current,
        [stage]: current[stage].map((item) => (item._id === updated._id ? updated : item)),
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to save document comment.");
    }
  };


  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: "8px", color: "#6A6D70", fontSize: "13px" }}>
        <LoaderCircle className="animate-spin" size={18} />
        Loading invoice data...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <FilterBar
        docType="INV"
        actionLabel="Display Data"
        onSearch={(next) => {
          setFilters(next);
          setHasSearched(true);
          setSelectedInvoice("");
          setAggregate(null);
          setError(null);
        }}
        valueHelpItems={valueHelpItems}
        valueHelpSources={{
          prNumber: prRecords.map((record) => ({ id: record.pr_number, description: "" })),
          poNumber: poRecords.map((record) => ({ id: record.po_number, description: "" })),
          grnNumber: grnRecords.map((record) => ({ id: record.grn_number, description: "" })),
        }}
        values={filters}
        fieldOptions={{}}
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {hasSearched ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", padding: "4px 0" }}>
              {[
                { label: "Invoice Overview", ref: overviewSectionRef },
                { label: "Linked Purchase Requisition (PR)", ref: prSectionRef },
                { label: "Linked Purchase Order (PO)", ref: poSectionRef },
                { label: "Linked Goods Receipt Note (GRN)", ref: grnSectionRef },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => item.ref.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  style={{
                    border: "1px solid #d9d9d9",
                    backgroundColor: "#ffffff",
                    color: "#334155",
                    borderRadius: "999px",
                    padding: "7px 12px",
                    fontSize: "11px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}

          {!hasSearched ? null : (
            <div ref={overviewSectionRef}>
              <SectionTable
                title="Invoice Overview"
                badge={`${displayRows.length} invoice record(s)`}
                collapsible
                collapsed={hiddenSections.overview}
                onToggle={() => setHiddenSections((current) => ({ ...current, overview: !current.overview }))}
              >
              <DataTable
                headers={["PR Number", "PO Number", "GRN Number", "Status", "Created"]}
                emptyMessage="No invoices found for the selected filters."
              >
                {displayRows.map((row, index) => (
                  <tr
                    key={`${row.synthetic ? "synthetic" : "live"}-${row.invoiceNumber}`}
                    onClick={() => void selectInvoice(row)}
                    style={{
                      borderBottom: "1px solid #eeeeee",
                      backgroundColor: selectedInvoice === row.invoiceNumber ? "#EAF1FF" : index % 2 === 0 ? "#ffffff" : "#fafcff",
                      cursor: "pointer",
                    }}
                  >
                    <td style={{ ...TD_STYLE, color: "#2563eb" }}>{row.prNumber || ""}</td>
                    <td style={{ ...TD_STYLE, color: "#2563eb" }}>{row.poNumber || ""}</td>
                    <td style={{ ...TD_STYLE, color: "#2563eb" }}>{row.grnNumber || ""}</td>
                    <td style={TD_STYLE}>{statusBadge(row.status, row.synthetic)}</td>
                    <td style={{ ...TD_STYLE, borderRight: "none" }}>{formatDate(row.createdAt)}</td>
                  </tr>
                ))}
              </DataTable>
              </SectionTable>
            </div>
          )}

          {hasSearched && !selectedInvoice ? (
            <SelectionPlaceholder
              title="Select an invoice row to view linked records"
              description="Once an invoice row is selected, the linked PR, PO, and GRN tables will be shown together in a single consistent detail view."
            />
          ) : null}

          {hasSearched && selectedInvoice && activeAggregate ? (
            <>
              {detailLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "32px", gap: "8px", color: "#6A6D70", fontSize: "13px" }}>
                  <LoaderCircle className="animate-spin" size={18} />
                  Loading linked invoice details...
                </div>
              ) : null}

              <div ref={prSectionRef}>
              <SectionTable
                title="Linked Purchase Requisition (PR)"
                badge={activeAggregate.purchase_requisition?.items.length ? `${activeAggregate.purchase_requisition.items.length} item(s)` : undefined}
                collapsible
                collapsed={hiddenSections.pr}
                onToggle={() => setHiddenSections((current) => ({ ...current, pr: !current.pr }))}
              >
                {activeAggregate.purchase_requisition ? (
                  <>
                    <DataTable headers={["PR Number", "Item Number", "Material", "Material Description", "Plant", "Quantity", "Price", "Amount", "Purchase Organization"]}>
                      {activeAggregate.purchase_requisition.items.map((item, index) => (
                        <tr key={item.item_number} style={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "#fafcff" }}>
                          <td style={{ ...TD_STYLE, color: "#2563eb", fontWeight: "700" }}>{index === 0 ? activeAggregate.purchase_requisition?.pr_number : ""}</td>
                          <td style={TD_STYLE}>{item.item_number || "—"}</td>
                          <td style={TD_STYLE}>{item.material || ""}</td>
                          <td style={TD_STYLE}>{item.material_description || ""}</td>
                          <td style={TD_STYLE}>{item.plant}</td>
                          <td style={{ ...TD_STYLE, textAlign: "right" }}>{item.quantity}</td>
                          <td style={{ ...TD_STYLE, textAlign: "right" }}>{formatCurrency(item.price)}</td>
                          <td style={{ ...TD_STYLE, textAlign: "right" }}>{formatCurrency(item.amount)}</td>
                          <td style={{ ...TD_STYLE, borderRight: "none" }}>{item.purchase_organization || ""}</td>
                        </tr>
                      ))}
                    </DataTable>
                    <AttachmentSubCard
                      title="PR Attachments"
                      stage="PR"
                      reference={activeAggregate.purchase_requisition.pr_number}
                      docs={linkedDocs.PR}
                      loading={docsLoading.PR}
                      onReview={handleLinkedDocumentReview}
                      onComment={handleLinkedDocumentComment}
                    />
                  </>
                ) : (
                  <div style={{ padding: "18px 20px", fontSize: "12px", color: "#8a8b8c" }}>No linked PR details found for this invoice.</div>
                )}
              </SectionTable>
              </div>

              <div ref={poSectionRef}>
              <SectionTable
                title="Linked Purchase Order (PO)"
                badge={activeAggregate.purchase_order?.items.length ? `${activeAggregate.purchase_order.items.length} item(s)` : undefined}
                collapsible
                collapsed={hiddenSections.po}
                onToggle={() => setHiddenSections((current) => ({ ...current, po: !current.po }))}
              >
                {activeAggregate.purchase_order ? (
                  <>
                    <DataTable headers={["PO Number", "Item Number", "Material", "Material Description", "Quantity", "Price", "Amount", "Plant"]}>
                      {activeAggregate.purchase_order.items.map((item, index) => (
                        <tr key={item.item_number} style={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "#fafcff" }}>
                          <td style={{ ...TD_STYLE, color: "#2563eb", fontWeight: "700" }}>{index === 0 ? activeAggregate.purchase_order?.po_number : ""}</td>
                          <td style={TD_STYLE}>{item.item_number || "—"}</td>
                          <td style={TD_STYLE}>{item.material || ""}</td>
                          <td style={TD_STYLE}>{item.material_description || ""}</td>
                          <td style={{ ...TD_STYLE, textAlign: "right" }}>{item.quantity}</td>
                          <td style={{ ...TD_STYLE, textAlign: "right" }}>{formatCurrency(item.price)}</td>
                          <td style={{ ...TD_STYLE, textAlign: "right" }}>{formatCurrency(item.amount)}</td>
                          <td style={{ ...TD_STYLE, borderRight: "none" }}>{item.plant}</td>
                        </tr>
                      ))}
                    </DataTable>
                    <AttachmentSubCard
                      title="PO Attachments"
                      stage="PO"
                      reference={activeAggregate.purchase_order.po_number}
                      docs={linkedDocs.PO}
                      loading={docsLoading.PO}
                      onReview={handleLinkedDocumentReview}
                      onComment={handleLinkedDocumentComment}
                    />
                  </>
                ) : (
                  <div style={{ padding: "18px 20px", fontSize: "12px", color: "#8a8b8c" }}>No linked PO details found for this invoice.</div>
                )}
              </SectionTable>
              </div>

              <div ref={grnSectionRef}>
              <SectionTable
                title="Linked Goods Receipt Note (GRN)"
                badge={activeAggregate.goods_receipt?.items.length ? `${activeAggregate.goods_receipt.items.length} item(s)` : undefined}
                collapsible
                collapsed={hiddenSections.grn}
                onToggle={() => setHiddenSections((current) => ({ ...current, grn: !current.grn }))}
              >
                {activeAggregate.goods_receipt ? (
                  <>
                    <DataTable headers={["GRN Number", "Item Number", "Material", "Material Description", "Quantity", "Price", "Amount", "Plant", "Purchase Order"]}>
                      {activeAggregate.goods_receipt.items.map((item, index) => (
                        <tr key={item.item_number} style={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "#fafcff" }}>
                          <td style={{ ...TD_STYLE, color: "#2563eb", fontWeight: "700" }}>{index === 0 ? activeAggregate.goods_receipt?.grn_number : ""}</td>
                          <td style={TD_STYLE}>{item.item_number || "—"}</td>
                          <td style={TD_STYLE}>{item.material || ""}</td>
                          <td style={TD_STYLE}>{item.material_description || ""}</td>
                          <td style={{ ...TD_STYLE, textAlign: "right" }}>{item.quantity}</td>
                          <td style={{ ...TD_STYLE, textAlign: "right" }}>{formatCurrency(item.price)}</td>
                          <td style={{ ...TD_STYLE, textAlign: "right" }}>{formatCurrency(item.amount)}</td>
                          <td style={TD_STYLE}>{item.plant}</td>
                          <td style={{ ...TD_STYLE, borderRight: "none" }}>{item.purchase_order || activeAggregate.goods_receipt?.po_number || ""}</td>
                        </tr>
                      ))}
                    </DataTable>
                    <AttachmentSubCard
                      title="GRN Attachments"
                      stage="GRN"
                      reference={activeAggregate.goods_receipt.grn_number}
                      docs={linkedDocs.GRN}
                      loading={docsLoading.GRN}
                      onReview={handleLinkedDocumentReview}
                      onComment={handleLinkedDocumentComment}
                    />
                  </>
                ) : (
                  <div style={{ padding: "18px 20px", fontSize: "12px", color: "#8a8b8c" }}>No linked GRN details found for this invoice.</div>
                )}
              </SectionTable>
              </div>
            </>
          ) : null}

          {hasSearched && selectedInvoice && !activeAggregate && !detailLoading ? (
            <SelectionPlaceholder
              title="No linked invoice chain available"
              description="The selected filters did not resolve to a complete invoice view yet. Try a linked PR, PO, or GRN that belongs to the same chain."
            />
          ) : null}
        </div>
      </div>

      <ModuleFooterAlerts
        error={error}
        infoMessage={usesSyntheticLinkage ? "A generated demo linkage is being shown so the complete PR, PO, and GRN view can still be reviewed." : null}
        validation={null}
      />
    </div>
  );
}
