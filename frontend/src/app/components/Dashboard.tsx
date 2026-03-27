import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FileText, MessageSquare, Minus, Send, ShoppingCart, X } from "lucide-react";
import { getDashboardStages, getDashboardSummary, getRecentActivity } from "../lib/api";
import { formatDateTime, statusTone } from "../lib/format";
import type { DashboardSummary, RecentActivityItem, StageKey, StageStatusRecord } from "../lib/types";

type SortKey = "type" | "total" | "uploaded" | "missing" | "ocrReview";

type SummaryRow = {
  type: string;
  total: number;
  uploaded: number;
  missing: number;
  ocrReview: number;
};

const CHAT_SUGGESTIONS = ["Show missing documents", "Pending OCR review", "Recent uploads", "How many invoices were sent to MIRO?"];

function stageLabel(stage: StageKey) {
  if (stage === "PR") return "Purchase Requisition (PR)";
  if (stage === "PO") return "Purchase Order (PO)";
  if (stage === "GRN") return "Goods Receipt Note (GRN)";
  return "Invoice Verification";
}

export function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [stages, setStages] = useState<Record<StageKey, StageStatusRecord[]> | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("type");
  const [sortAsc, setSortAsc] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<Array<{ from: "user" | "bot"; text: string }>>([{ from: "bot", text: "Hello! I'm your DVP assistant. Ask me about document status, OCR reviews, or recent uploads." }]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryResponse, stageResponse, activityResponse] = await Promise.all([getDashboardSummary(), getDashboardStages(), getRecentActivity(10)]);
      setSummary(summaryResponse);
      setStages(stageResponse);
      setRecentActivity(activityResponse.activities);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);
  useEffect(() => { if (chatOpen && !chatMinimized) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMinimized, chatOpen, messages]);

  const summaryRows = useMemo<SummaryRow[]>(() => {
    if (!summary || !stages) return [];
    const rows: SummaryRow[] = ["PR", "PO", "GRN", "INVOICE"].map((stage) => ({
      type: stageLabel(stage as StageKey),
      total: summary.document_upload_status[stage as StageKey].total,
      uploaded: summary.document_upload_status[stage as StageKey].with_docs,
      missing: summary.document_upload_status[stage as StageKey].missing,
      ocrReview: stages[stage as StageKey].filter((item) => item.documents.some((document) => document.ocr_status === "REVIEW" || document.ocr_status === "INVALID")).length,
    }));

    const totals = rows.reduce((accumulator, row) => ({
      type: "Total",
      total: accumulator.total + row.total,
      uploaded: accumulator.uploaded + row.uploaded,
      missing: accumulator.missing + row.missing,
      ocrReview: accumulator.ocrReview + row.ocrReview,
    }), { type: "Total", total: 0, uploaded: 0, missing: 0, ocrReview: 0 });

    return [...rows, totals];
  }, [stages, summary]);

  const sortedRows = useMemo(() => {
    return [...summaryRows].sort((a, b) => {
      if (a.type === "Total") return 1;
      if (b.type === "Total") return -1;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
  }, [sortAsc, sortKey, summaryRows]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((current) => !current);
    else { setSortKey(key); setSortAsc(true); }
  };

  const assistantReply = (text: string) => {
    if (!summary || !stages) return "Dashboard data is still loading.";
    const input = text.toLowerCase();
    if (input.includes("missing")) {
      const stageLines = (Object.entries(summary.document_upload_status) as Array<[StageKey, DashboardSummary["document_upload_status"][StageKey]]>)
        .map(([stage, stageSummary]) => `${stage}: ${stageSummary.missing} missing`)
        .join("\n");
      return `Missing documents by stage:\n${stageLines}`;
    }
    if (input.includes("review") || input.includes("ocr")) {
      return `OCR summary:\n• Valid: ${summary.ocr_summary.valid}\n• Review: ${summary.ocr_summary.review}\n• Invalid: ${summary.ocr_summary.invalid}\n• Pending: ${summary.ocr_summary.pending}`;
    }
    if (input.includes("recent")) {
      return recentActivity.length === 0 ? "No recent document activity." : `Recent uploads:\n${recentActivity.slice(0, 5).map((item) => `• ${item.stage} ${item.reference_number} — ${item.original_filename} (${item.ocr_status})`).join("\n")}`;
    }
    if (input.includes("miro")) {
      return `${summary.miro_sent} invoice(s) have been sent to MIRO.`;
    }
    return "Try asking about missing documents, OCR review, recent uploads, or MIRO status.";
  };

  const sendMessage = (value: string) => {
    const message = value.trim();
    if (!message) return;
    setMessages((current) => [...current, { from: "user", text: message }]);
    setChatInput("");
    window.setTimeout(() => {
      setMessages((current) => [...current, { from: "bot", text: assistantReply(message) }]);
    }, 250);
  };

  const SortIcon = ({ column }: { column: SortKey }) => sortKey === column ? (sortAsc ? <ChevronUp size={11} className="inline ml-1" /> : <ChevronDown size={11} className="inline ml-1" />) : <ChevronDown size={11} className="inline ml-1 opacity-30" />;

  if (loading) {
    return <div className="flex items-center justify-center h-full" style={{ color: "#6A6D70" }}>Loading dashboard...</div>;
  }

  return (
    <div className="p-0 h-full flex flex-col">
      <div className="px-5 py-3 border-b flex items-center justify-between flex-shrink-0" style={{ backgroundColor: "#ffffff", borderColor: "#d9d9d9" }}>
        <div>
          <div style={{ fontSize: "11px", color: "#8a8b8c" }}>Home</div>
          <h1 style={{ fontSize: "16px", fontWeight: "600", color: "#32363a", margin: 0 }}>Dashboard</h1>
        </div>
        <div style={{ fontSize: "11px", color: "#8a8b8c" }}>Live backend summary</div>
      </div>

      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {error ? <div className="border px-4 py-3" style={{ borderColor: "#F0B2B2", backgroundColor: "#FBEAEA", color: "#BB0000", borderRadius: "2px", fontSize: "12px" }}>{error}</div> : null}

        {summary ? (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total PR Documents", value: summary.document_upload_status.PR.with_docs, sub: `${summary.document_upload_status.PR.missing} missing`, icon: FileText, color: "#0070F2", bg: "#E8F1FB" },
              { label: "Total PO Documents", value: summary.document_upload_status.PO.with_docs, sub: `${summary.document_upload_status.PO.missing} missing`, icon: ShoppingCart, color: "#107E3E", bg: "#EEF5EC" },
              { label: "OCR Reviews", value: summary.ocr_summary.review + summary.ocr_summary.invalid, sub: `${summary.ocr_summary.valid} valid`, icon: AlertTriangle, color: "#E9730C", bg: "#FEF3E8" },
              { label: "Unread Notifications", value: summary.notifications.unread, sub: `${summary.miro_sent} sent to MIRO`, icon: CheckCircle2, color: "#BB0000", bg: "#FBEAEA" },
            ].map((card) => (
              <div key={card.label} className="border flex items-center gap-3 p-3" style={{ backgroundColor: "#ffffff", borderColor: "#d9d9d9", borderRadius: "2px" }}>
                <div className="flex items-center justify-center flex-shrink-0" style={{ width: "40px", height: "40px", backgroundColor: card.bg, borderRadius: "2px" }}><card.icon size={18} color={card.color} /></div>
                <div>
                  <div style={{ fontSize: "22px", fontWeight: "700", color: card.color, lineHeight: "1.1" }}>{card.value}</div>
                  <div style={{ fontSize: "11px", color: "#32363a", fontWeight: "500" }}>{card.label}</div>
                  <div style={{ fontSize: "10px", color: "#8a8b8c" }}>{card.sub}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <div className="border" style={{ backgroundColor: "#ffffff", borderColor: "#d9d9d9", borderRadius: "2px" }}>
            <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: "#d9d9d9", backgroundColor: "#f5f5f5" }}>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#32363a" }}>Document Summary</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f5f5f5", borderBottom: "1px solid #d9d9d9" }}>
                    {(["type", "total", "uploaded", "missing", "ocrReview"] as SortKey[]).map((column) => (
                      <th key={column} onClick={() => handleSort(column)} className="text-left cursor-pointer select-none" style={{ padding: "6px 12px", fontSize: "12px", fontWeight: "600", color: "#32363a", borderRight: "1px solid #e5e5e5", whiteSpace: "nowrap" }}>
                        {column === "type" ? "Document Type" : column === "ocrReview" ? "OCR Review" : column.charAt(0).toUpperCase() + column.slice(1)}
                        <SortIcon column={column} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row, index) => (
                    <tr key={row.type} style={{ borderBottom: "1px solid #eeeeee", backgroundColor: row.type === "Total" ? "#f5f5f5" : index % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                      <td style={{ padding: "6px 12px", fontSize: "12px", color: "#32363a", fontWeight: row.type === "Total" ? "600" : "400", borderRight: "1px solid #e5e5e5" }}>{row.type}</td>
                      <td style={{ padding: "6px 12px", fontSize: "12px", color: "#32363a", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.total}</td>
                      <td style={{ padding: "6px 12px", fontSize: "12px", color: "#107E3E", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.uploaded}</td>
                      <td style={{ padding: "6px 12px", fontSize: "12px", color: row.missing > 0 ? "#BB0000" : "#32363a", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.missing}</td>
                      <td style={{ padding: "6px 12px", fontSize: "12px", color: row.ocrReview > 0 ? "#E9730C" : "#32363a", textAlign: "right" }}>{row.ocrReview}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border" style={{ backgroundColor: "#ffffff", borderColor: "#d9d9d9", borderRadius: "2px" }}>
            <div className="px-4 py-2 border-b" style={{ borderColor: "#d9d9d9", backgroundColor: "#f5f5f5" }}>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#32363a" }}>Recent Activity</span>
            </div>
            <div>
              {recentActivity.length === 0 ? <div style={{ padding: "16px", fontSize: "12px", color: "#8a8b8c" }}>No recent document activity.</div> : recentActivity.map((activity, index) => {
                const tone = statusTone(activity.ocr_status);
                return (
                  <div key={activity._id} className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: index === recentActivity.length - 1 ? "transparent" : "#eeeeee" }}>
                    <div>
                      <div style={{ fontSize: "12px", color: "#32363a", fontWeight: "500" }}>{activity.original_filename}</div>
                      <div style={{ fontSize: "11px", color: "#8a8b8c" }}>{activity.stage} {activity.reference_number} • {formatDateTime(activity.uploaded_at)}</div>
                    </div>
                    <span style={{ fontSize: "11px", color: tone.color, backgroundColor: tone.bg, padding: "2px 6px", borderRadius: "2px", fontWeight: "600" }}>{activity.ocr_status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {chatOpen && (
        <div className="fixed flex flex-col shadow-2xl border z-50" style={{ bottom: "80px", right: "24px", width: "320px", height: chatMinimized ? "0px" : "420px", overflow: "hidden", backgroundColor: "#ffffff", borderColor: "#d9d9d9", borderRadius: "4px", transition: "height 0.2s ease" }}>
          <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0" style={{ backgroundColor: "#003B62", borderColor: "#d9d9d9" }}>
            <MessageSquare size={14} color="#ffffff" />
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#ffffff" }}>DVP Assistant</span>
            <div className="ml-auto flex items-center gap-1">
              <button onClick={() => setChatMinimized((current) => !current)}>{chatMinimized ? <ChevronUp size={14} color="#ffffff" /> : <Minus size={14} color="#ffffff" />}</button>
              <button onClick={() => setChatOpen(false)}><X size={14} color="#ffffff" /></button>
            </div>
          </div>
          {!chatMinimized && (
            <>
              <div className="flex-1 overflow-auto p-3 flex flex-col gap-2">
                {messages.map((message, index) => (
                  <div key={`${message.from}-${index}`} className={`max-w-[85%] px-3 py-2 ${message.from === "user" ? "self-end" : "self-start"}`} style={{ backgroundColor: message.from === "user" ? "#0070F2" : "#f5f5f5", color: message.from === "user" ? "#ffffff" : "#32363a", borderRadius: "8px", fontSize: "12px", whiteSpace: "pre-wrap" }}>{message.text}</div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="px-3 py-2 border-t" style={{ borderColor: "#eeeeee", backgroundColor: "#fafafa" }}>
                <div className="flex flex-wrap gap-2 mb-2">{CHAT_SUGGESTIONS.map((item) => <button key={item} onClick={() => sendMessage(item)} className="px-2 py-1 border" style={{ fontSize: "11px", borderColor: "#d9d9d9", borderRadius: "12px", backgroundColor: "#ffffff", color: "#32363a" }}>{item}</button>)}</div>
                <div className="flex gap-2">
                  <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") sendMessage(chatInput); }} placeholder="Ask about document status..." className="flex-1 border px-3 py-2 outline-none" style={{ fontSize: "12px", borderColor: "#d9d9d9", borderRadius: "2px" }} />
                  <button onClick={() => sendMessage(chatInput)} className="px-3 py-2 border" style={{ borderColor: "#0070F2", backgroundColor: "#0070F2", color: "#ffffff", borderRadius: "2px" }}><Send size={14} /></button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <button onClick={() => { setChatOpen(true); setChatMinimized(false); }} className="fixed bottom-6 right-6 rounded-full shadow-lg" style={{ width: "54px", height: "54px", backgroundColor: "#0070F2", color: "#ffffff" }}><MessageSquare size={22} className="mx-auto" /></button>
    </div>
  );
}
