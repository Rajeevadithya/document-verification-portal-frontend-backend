import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, FileText, ShoppingCart, Truck, XCircle } from "lucide-react";
import { getDashboardStages, getDashboardSummary, getRecentActivity } from "../lib/api";
import { formatDateTime, statusTone } from "../lib/format";
import type { DashboardSummary, RecentActivityItem, StageKey, StageStatusRecord } from "../lib/types";

type SummaryRow = {
  type: string;
  total: number;
  uploaded: number;
  missing: number;
};

type ApprovalRow = {
  type: string;
  accepted: number;
  rejected: number;
  pending: number;
};

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryResponse, stageResponse, activityResponse] = await Promise.all([
        getDashboardSummary(),
        getDashboardStages(),
        getRecentActivity(10),
      ]);
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

  const summaryRows = useMemo<SummaryRow[]>(() => {
    if (!summary) return [];
    const rows: SummaryRow[] = ["PR", "PO", "GRN"].map((stage) => ({
      type: stageLabel(stage as StageKey),
      total: summary.document_upload_status[stage as StageKey].total,
      uploaded: summary.document_upload_status[stage as StageKey].with_docs,
      missing: summary.document_upload_status[stage as StageKey].missing,
    }));

    const totals = rows.reduce(
      (acc, row) => ({
        type: "Total",
        total: acc.total + row.total,
        uploaded: acc.uploaded + row.uploaded,
        missing: acc.missing + row.missing,
      }),
      { type: "Total", total: 0, uploaded: 0, missing: 0 }
    );

    return [...rows, totals];
  }, [summary]);

  const approvalRows = useMemo<ApprovalRow[]>(() => {
    if (!summary) return [];
    const rows: ApprovalRow[] = ["PR", "PO", "GRN"].map((stage) => ({
      type: stageLabel(stage as StageKey),
      accepted: summary.approval_status[stage as StageKey].accepted,
      rejected: summary.approval_status[stage as StageKey].rejected,
      pending: summary.approval_status[stage as StageKey].pending,
    }));

    const totals = rows.reduce(
      (acc, row) => ({
        type: "Total",
        accepted: acc.accepted + row.accepted,
        rejected: acc.rejected + row.rejected,
        pending: acc.pending + row.pending,
      }),
      { type: "Total", accepted: 0, rejected: 0, pending: 0 }
    );

    return [...rows, totals];
  }, [summary]);

  const latestDecisions = useMemo(() => {
    if (!stages) return [];
    return (["PR", "PO", "GRN"] as StageKey[])
      .flatMap((stage) =>
        stages[stage]
          .filter((item) => item.latest_document)
          .map((item) => ({
            stage,
            reference_number: item.reference_number,
            document: item.latest_document!,
          }))
      )
      .sort((a, b) => {
        const aDate = a.document.reviewed_at || a.document.uploaded_at;
        const bDate = b.document.reviewed_at || b.document.uploaded_at;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      })
      .slice(0, 8);
  }, [stages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "#6A6D70" }}>
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="p-0 h-full flex flex-col">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div
        className="px-5 py-3 border-b flex items-center justify-between flex-shrink-0"
        style={{ backgroundColor: "#ffffff", borderColor: "#d9d9d9" }}
      >
        <div>
          <div style={{ fontSize: "11px", color: "#8a8b8c" }}>Home</div>
          <h1 style={{ fontSize: "16px", fontWeight: "600", color: "#32363a", margin: 0 }}>Global Dashboard</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {error && (
          <div
            className="border px-4 py-3"
            style={{ borderColor: "#F0B2B2", backgroundColor: "#FBEAEA", color: "#BB0000", borderRadius: "2px", fontSize: "12px" }}
          >
            {error}
          </div>
        )}

        {/* ── KPI cards ─────────────────────────────────────────────── */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[
              { label: "Total PR Documents", value: summary.document_upload_status.PR.with_docs, sub: `${summary.document_upload_status.PR.missing} not uploaded`, icon: FileText, color: "#0070F2", bg: "#E8F1FB" },
              { label: "Total PO Documents", value: summary.document_upload_status.PO.with_docs, sub: `${summary.document_upload_status.PO.missing} not uploaded`, icon: ShoppingCart, color: "#107E3E", bg: "#EEF5EC" },
              { label: "Total GRN Documents", value: summary.document_upload_status.GRN.with_docs, sub: `${summary.document_upload_status.GRN.missing} not uploaded`, icon: Truck, color: "#E9730C", bg: "#FEF3E8" },
              { label: "Accepted Uploads", value: summary.approval_summary.accepted, sub: "Documents approved by reviewer", icon: CheckCircle2, color: "#107E3E", bg: "#EEF5EC" },
              { label: "Rejected Uploads", value: summary.approval_summary.rejected, sub: "Documents rejected by reviewer", icon: XCircle, color: "#BB0000", bg: "#FBEAEA" },
              { label: "Pending Review", value: summary.approval_summary.pending, sub: "Documents waiting for decision", icon: Clock3, color: "#E9730C", bg: "#FEF3E8" },
            ].map((card) => (
              <div
                key={card.label}
                className="border flex items-center gap-3 p-3"
                style={{ backgroundColor: "#ffffff", borderColor: "#d9d9d9", borderRadius: "18px" }}
              >
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: "40px", height: "40px", backgroundColor: card.bg, borderRadius: "14px" }}
                >
                  <card.icon size={18} color={card.color} />
                </div>
                <div>
                  <div style={{ fontSize: "22px", fontWeight: "700", color: card.color, lineHeight: "1.1" }}>{card.value}</div>
                  <div style={{ fontSize: "11px", color: "#32363a", fontWeight: "500" }}>{card.label}</div>
                  <div style={{ fontSize: "10px", color: "#8a8b8c" }}>{card.sub}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tables ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Document summary */}
          <div className="border overflow-hidden" style={{ backgroundColor: "#ffffff", borderColor: "#d9d9d9", borderRadius: "18px" }}>
            <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: "#d9d9d9", backgroundColor: "#f5f5f5" }}>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#32363a" }}>Document Summary</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f5f5f5", borderBottom: "1px solid #d9d9d9" }}>
                    {["Document Type", "Total", "Uploaded", "Not Uploaded"].map((label) => (
                      <th
                        key={label}
                        className="text-left"
                        style={{ padding: "6px 12px", fontSize: "12px", fontWeight: "600", color: "#32363a", borderRight: "1px solid #e5e5e5", whiteSpace: "nowrap" }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row, i) => (
                    <tr key={row.type} style={{ borderBottom: "1px solid #eeeeee", backgroundColor: row.type === "Total" ? "#f5f5f5" : i % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                      <td style={{ padding: "6px 12px", fontSize: "12px", color: "#32363a", fontWeight: row.type === "Total" ? "600" : "400", borderRight: "1px solid #e5e5e5" }}>{row.type}</td>
                      <td style={{ padding: "6px 12px", fontSize: "12px", color: "#32363a", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.total}</td>
                      <td style={{ padding: "6px 12px", fontSize: "12px", color: "#107E3E", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.uploaded}</td>
                      <td style={{ padding: "6px 12px", fontSize: "12px", color: row.missing > 0 ? "#BB0000" : "#32363a", textAlign: "right" }}>{row.missing}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="border overflow-hidden" style={{ backgroundColor: "#ffffff", borderColor: "#d9d9d9", borderRadius: "18px" }}>
            <div className="px-4 py-2 border-b" style={{ borderColor: "#d9d9d9", backgroundColor: "#f5f5f5" }}>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#32363a" }}>Recent Activity</span>
            </div>
            <div>
              {recentActivity.length === 0 ? (
                <div style={{ padding: "16px", fontSize: "12px", color: "#8a8b8c" }}>No recent document activity.</div>
              ) : (
                recentActivity.map((activity, index) => {
                  const tone = statusTone(activity.ocr_status);
                  return (
                    <div
                      key={activity._id}
                      className="px-4 py-3 border-b flex items-center justify-between"
                      style={{ borderColor: index === recentActivity.length - 1 ? "transparent" : "#eeeeee" }}
                    >
                      <div>
                        <div style={{ fontSize: "12px", color: "#32363a", fontWeight: "500" }}>{activity.original_filename}</div>
                        <div style={{ fontSize: "11px", color: "#8a8b8c" }}>{activity.stage} {activity.reference_number} • {formatDateTime(activity.uploaded_at)}</div>
                      </div>
                      <span style={{ fontSize: "11px", color: tone.color, backgroundColor: tone.bg, padding: "2px 6px", borderRadius: "2px", fontWeight: "600" }}>{activity.ocr_status}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="border overflow-hidden" style={{ backgroundColor: "#ffffff", borderColor: "#d9d9d9", borderRadius: "18px" }}>
            <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: "#d9d9d9", backgroundColor: "#f5f5f5" }}>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#32363a" }}>Approval Summary</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f5f5f5", borderBottom: "1px solid #d9d9d9" }}>
                    {["Document Type", "Accepted", "Rejected", "Pending"].map((label) => (
                      <th
                        key={label}
                        className="text-left"
                        style={{ padding: "6px 12px", fontSize: "12px", fontWeight: "600", color: "#32363a", borderRight: "1px solid #e5e5e5", whiteSpace: "nowrap" }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {approvalRows.map((row, i) => (
                    <tr key={row.type} style={{ borderBottom: "1px solid #eeeeee", backgroundColor: row.type === "Total" ? "#f5f5f5" : i % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                      <td style={{ padding: "6px 12px", fontSize: "12px", color: "#32363a", fontWeight: row.type === "Total" ? "600" : "400", borderRight: "1px solid #e5e5e5" }}>{row.type}</td>
                      <td style={{ padding: "6px 12px", fontSize: "12px", color: "#107E3E", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.accepted}</td>
                      <td style={{ padding: "6px 12px", fontSize: "12px", color: "#BB0000", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.rejected}</td>
                      <td style={{ padding: "6px 12px", fontSize: "12px", color: "#E9730C", textAlign: "right" }}>{row.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border overflow-hidden" style={{ backgroundColor: "#ffffff", borderColor: "#d9d9d9", borderRadius: "18px" }}>
            <div className="px-4 py-2 border-b" style={{ borderColor: "#d9d9d9", backgroundColor: "#f5f5f5" }}>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#32363a" }}>Latest Approval Decisions</span>
            </div>
            <div>
              {latestDecisions.length === 0 ? (
                <div style={{ padding: "16px", fontSize: "12px", color: "#8a8b8c" }}>No approval decisions yet.</div>
              ) : (
                latestDecisions.map((item, index) => {
                  const tone = statusTone(item.document.review_status);
                  return (
                    <div
                      key={`${item.stage}-${item.reference_number}-${item.document._id}`}
                      className="px-4 py-3 border-b"
                      style={{ borderColor: index === latestDecisions.length - 1 ? "transparent" : "#eeeeee" }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div style={{ fontSize: "12px", color: "#32363a", fontWeight: "500" }}>
                            {item.stage} {item.reference_number}
                          </div>
                          <div style={{ fontSize: "11px", color: "#8a8b8c" }}>
                            {item.document.original_filename} • {formatDateTime(item.document.reviewed_at || item.document.uploaded_at)}
                          </div>
                          {item.document.review_comment ? (
                            <div style={{ fontSize: "11px", color: "#6A6D70", marginTop: "4px" }}>
                              {item.document.review_comment}
                            </div>
                          ) : null}
                        </div>
                        <span style={{ fontSize: "11px", color: tone.color, backgroundColor: tone.bg, padding: "2px 6px", borderRadius: "2px", fontWeight: "600" }}>
                          {item.document.review_status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}