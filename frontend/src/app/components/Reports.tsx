import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  FileText,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { getDashboardSummary, listStageRecords } from "../lib/api";
import { formatDate, statusTone } from "../lib/format";
import type { DashboardSummary, GRNRecord, InvoiceRecord, PORecord, PRRecord } from "../lib/types";

type SummaryReportRow = {
  key: "PR" | "PO" | "GRN" | "INVOICE" | "TOTAL";
  docType: string;
  total: number;
  uploaded: number;
  pending: number;
  missing: number;
  compliance: string;
};

type MonthlyBucket = { month: string; PR: number; PO: number; GRN: number; INV: number };
type ReportDocType = "All" | "PR" | "PO" | "GRN" | "INV";

function reportLabel(stage: "PR" | "PO" | "GRN" | "INVOICE") {
  if (stage === "PR") return "Purchase Requisition (PR)";
  if (stage === "PO") return "Purchase Order (PO)";
  if (stage === "GRN") return "Goods Receipt Note (GRN)";
  return "Invoice Verification";
}

function matchesDateRange(value: string | undefined, from: string, to: string) {
  if (!value) return true;
  const current = new Date(value);
  if (Number.isNaN(current.getTime())) return true;
  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime()) && current < fromDate) return false;
  }
  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      if (current > toDate) return false;
    }
  }
  return true;
}

function SectionCard({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #d9d9d9",
        borderRadius: "18px",
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
      }}
    >
      <div
        className="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap"
        style={{ borderColor: "#d9d9d9", backgroundColor: "#f5f5f5" }}
      >
        <span style={{ fontSize: "13px", fontWeight: "600", color: "#32363a" }}>{title}</span>
        {badge ? <span style={{ fontSize: "11px", color: "#8a8b8c", fontWeight: "600" }}>{badge}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function Reports() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [records, setRecords] = useState<{ PR: PRRecord[]; PO: PORecord[]; GRN: GRNRecord[]; INV: InvoiceRecord[] } | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [docType, setDocType] = useState<ReportDocType>("All");
  const [activeChart, setActiveChart] = useState<"bar" | "line">("bar");
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryResponse, pr, po, grn, inv] = await Promise.all([
        getDashboardSummary(),
        listStageRecords("PR"),
        listStageRecords("PO"),
        listStageRecords("GRN"),
        listStageRecords("INVOICE"),
      ]);
      setSummary(summaryResponse);
      setRecords({ PR: pr as PRRecord[], PO: po as PORecord[], GRN: grn as GRNRecord[], INV: inv as InvoiceRecord[] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const summaryReport = useMemo<SummaryReportRow[]>(() => {
    if (!summary) return [];

    const rows: SummaryReportRow[] = ([
      { key: "PR", label: reportLabel("PR") },
      { key: "PO", label: reportLabel("PO") },
      { key: "GRN", label: reportLabel("GRN") },
      { key: "INVOICE", label: reportLabel("INVOICE") },
    ] as const)
      .filter(({ key }) => docType === "All" || (docType === "INV" ? key === "INVOICE" : key === docType))
      .map(({ key, label }) => {
        const stage = summary.document_upload_status[key];
        const pending = Math.max(stage.total - stage.with_docs - stage.missing, 0);
        const compliance = stage.total > 0 ? `${Math.round((stage.with_docs / stage.total) * 100)}%` : "0%";
        return { key, docType: label, total: stage.total, uploaded: stage.with_docs, pending, missing: stage.missing, compliance };
      });

    const total = rows.reduce(
      (acc, row) => ({
        key: "TOTAL" as const,
        docType: "Total",
        total: acc.total + row.total,
        uploaded: acc.uploaded + row.uploaded,
        pending: acc.pending + row.pending,
        missing: acc.missing + row.missing,
        compliance: "0%",
      }),
      { key: "TOTAL" as const, docType: "Total", total: 0, uploaded: 0, pending: 0, missing: 0, compliance: "0%" }
    );

    total.compliance = total.total > 0 ? `${Math.round((total.uploaded / total.total) * 100)}%` : "0%";
    return [...rows, total];
  }, [docType, summary]);

  const filteredRecords = useMemo(() => {
    if (!records) return null;

    return {
      PR:
        docType === "All" || docType === "PR"
          ? records.PR.filter((record) => matchesDateRange(record.created_at, dateFrom, dateTo))
          : [],
      PO:
        docType === "All" || docType === "PO"
          ? records.PO.filter((record) => matchesDateRange(record.created_at, dateFrom, dateTo))
          : [],
      GRN:
        docType === "All" || docType === "GRN"
          ? records.GRN.filter((record) => matchesDateRange(record.created_at, dateFrom, dateTo))
          : [],
      INV:
        docType === "All" || docType === "INV"
          ? records.INV.filter((record) => matchesDateRange(record.created_at, dateFrom, dateTo))
          : [],
    };
  }, [dateFrom, dateTo, docType, records]);

  const statusDistribution = useMemo(() => {
    if (summaryReport.length === 0) return [];
    const rows = summaryReport.filter((row) => row.key !== "TOTAL");
    return [
      { name: "Uploaded", value: rows.reduce((sum, row) => sum + row.uploaded, 0), color: "#107E3E" },
      { name: "Pending", value: rows.reduce((sum, row) => sum + row.pending, 0), color: "#E9730C" },
      { name: "Missing", value: rows.reduce((sum, row) => sum + row.missing, 0), color: "#BB0000" },
    ];
  }, [summaryReport]);

  const monthlyData = useMemo<MonthlyBucket[]>(() => {
    if (!filteredRecords) return [];
    const buckets = new Map<string, MonthlyBucket>();

    const addBucket = (label: string) => {
      if (!buckets.has(label)) buckets.set(label, { month: label, PR: 0, PO: 0, GRN: 0, INV: 0 });
      return buckets.get(label)!;
    };

    filteredRecords.PR.forEach((record) => {
      const label = new Date(record.created_at).toLocaleString(undefined, { month: "short", year: "2-digit" });
      addBucket(label).PR += 1;
    });
    filteredRecords.PO.forEach((record) => {
      const label = new Date(record.created_at).toLocaleString(undefined, { month: "short", year: "2-digit" });
      addBucket(label).PO += 1;
    });
    filteredRecords.GRN.forEach((record) => {
      const label = new Date(record.created_at).toLocaleString(undefined, { month: "short", year: "2-digit" });
      addBucket(label).GRN += 1;
    });
    filteredRecords.INV.forEach((record) => {
      const label = new Date(record.created_at).toLocaleString(undefined, { month: "short", year: "2-digit" });
      addBucket(label).INV += 1;
    });

    return Array.from(buckets.values());
  }, [filteredRecords]);

  const vendorData = useMemo(() => {
    if (!filteredRecords) return [];
    const vendors = new Map<string, { vendor: string; documents: number; onTime: number; late: number }>();

    filteredRecords.PO.forEach((record) => {
      const current = vendors.get(record.vendor) || { vendor: record.vendor, documents: 0, onTime: 0, late: 0 };
      current.documents += 1;
      if (record.status === "OPEN" || record.status === "CLOSED") current.onTime += 1;
      else current.late += 1;
      vendors.set(record.vendor, current);
    });

    return Array.from(vendors.values()).sort((a, b) => b.documents - a.documents);
  }, [filteredRecords]);

  const totals = summaryReport.find((row) => row.key === "TOTAL");
  const rangeLabel = dateFrom || dateTo ? `${formatDate(dateFrom)} - ${formatDate(dateTo)}` : "All available dates";

  if (loading) {
    return <div className="flex items-center justify-center h-full" style={{ color: "#6A6D70" }}>Loading reports...</div>;
  }

  return (
    <div className="p-0 h-full flex flex-col">
      <div className="px-5 py-3 border-b flex items-center justify-between flex-shrink-0" style={{ backgroundColor: "#ffffff", borderColor: "#d9d9d9" }}>
        <div>
          <div style={{ fontSize: "11px", color: "#8a8b8c" }}>Home &rsaquo; Reports</div>
          <h1 style={{ fontSize: "16px", fontWeight: "600", color: "#32363a", margin: 0 }}>Reports & Analytics</h1>
        </div>
        <button
          className="flex items-center gap-2 px-3 py-2 border hover:bg-gray-50"
          style={{ fontSize: "12px", borderColor: "#d9d9d9", color: "#32363a", borderRadius: "10px", fontWeight: "600", backgroundColor: "#ffffff" }}
          onClick={() => window.print()}
        >
          <Download size={13} /> Export Report
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ backgroundColor: "#f7f7f7" }}>
        <div className="p-4 flex flex-col gap-4">
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #d9d9d9",
              borderRadius: "18px",
              overflow: "hidden",
              boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
            }}
          >
            <div className="px-5 py-4 border-b flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "#e5e7eb", backgroundColor: "#fafcff" }}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>Report Filters</div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>
                  {docType === "All" ? "All document types" : `Focused on ${docType}`} • {rangeLabel}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFiltersExpanded((current) => !current)}
                className="flex items-center gap-2"
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#334155",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #dbe3ee",
                  borderRadius: "10px",
                  padding: "8px 12px",
                }}
              >
                {filtersExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                {filtersExpanded ? "Hide Filters" : "Show Filters"}
              </button>
            </div>

            {filtersExpanded ? (
              <div className="px-5 py-5 flex flex-col gap-5">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "16px 24px",
                  }}
                >
                  <div className="flex flex-col gap-1">
                    <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748b" }}>Date From</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(event) => setDateFrom(event.target.value)}
                      className="border px-3 py-2 outline-none"
                      style={{ fontSize: "12px", borderColor: "#cbd5e1", color: "#334155", borderRadius: "8px", backgroundColor: "#ffffff", height: "40px", width: "100%" }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748b" }}>Date To</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(event) => setDateTo(event.target.value)}
                      className="border px-3 py-2 outline-none"
                      style={{ fontSize: "12px", borderColor: "#cbd5e1", color: "#334155", borderRadius: "8px", backgroundColor: "#ffffff", height: "40px", width: "100%" }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label style={{ fontSize: "11px", fontWeight: "600", color: "#64748b" }}>Document Type</label>
                    <div className="relative">
                      <select
                        value={docType}
                        onChange={(event) => setDocType(event.target.value as ReportDocType)}
                        className="border px-3 py-2 outline-none appearance-none"
                        style={{ fontSize: "12px", borderColor: "#cbd5e1", color: "#334155", borderRadius: "8px", backgroundColor: "#ffffff", height: "40px", width: "100%" }}
                      >
                        <option value="All">All Types</option>
                        <option value="PR">Purchase Requisition</option>
                        <option value="PO">Purchase Order</option>
                        <option value="GRN">Goods Receipt Note</option>
                        <option value="INV">Invoice</option>
                      </select>
                      <ChevronDown size={16} color="#334155" style={{ position: "absolute", right: "12px", top: "12px", pointerEvents: "none" }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>
                    Collapse filters anytime to let the tables and charts use more screen space.
                  </div>
                  <button
                    className="flex items-center gap-2 px-4 py-2"
                    style={{ fontSize: "12px", backgroundColor: "#1d4ed8", color: "#ffffff", borderRadius: "12px", fontWeight: "700" }}
                    onClick={() => void loadData()}
                  >
                    <RefreshCw size={12} /> Refresh Data
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {[
              {
                label: "Tracked Documents",
                value: totals?.total ?? 0,
                sub: "Current report scope",
                icon: FileText,
                color: "#0070F2",
                bg: "#E8F1FB",
              },
              {
                label: "Uploaded",
                value: totals?.uploaded ?? 0,
                sub: "Documents already attached",
                icon: CheckCircle2,
                color: "#107E3E",
                bg: "#EEF5EC",
              },
              {
                label: "Pending Follow-up",
                value: totals?.pending ?? 0,
                sub: "Waiting for completion",
                icon: Clock3,
                color: "#E9730C",
                bg: "#FEF3E8",
              },
              {
                label: "Missing",
                value: totals?.missing ?? 0,
                sub: "Need document upload",
                icon: XCircle,
                color: "#BB0000",
                bg: "#FBEAEA",
              },
            ].map((card) => (
              <div
                key={card.label}
                className="border flex items-center gap-3 p-3"
                style={{ backgroundColor: "#ffffff", borderColor: "#d9d9d9", borderRadius: "18px" }}
              >
                <div className="flex items-center justify-center flex-shrink-0" style={{ width: "40px", height: "40px", backgroundColor: card.bg, borderRadius: "14px" }}>
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

          <SectionCard title="Document Compliance Summary" badge="Dashboard-aligned overview">
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "880px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f5f5f5", borderBottom: "1px solid #d9d9d9" }}>
                    {["Document Type", "Total", "Uploaded", "Pending", "Missing", "Compliance %"].map((column, index, arr) => (
                      <th key={column} className="text-left" style={{ padding: "8px 12px", fontSize: "12px", fontWeight: "600", color: "#32363a", borderRight: index === arr.length - 1 ? "none" : "1px solid #e5e5e5", whiteSpace: "nowrap" }}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summaryReport.map((row, index) => (
                    <tr key={row.docType} style={{ borderBottom: "1px solid #eeeeee", backgroundColor: row.key === "TOTAL" ? "#f5f5f5" : index % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                      <td style={{ padding: "8px 12px", fontSize: "12px", color: "#32363a", fontWeight: row.key === "TOTAL" ? "600" : "400", borderRight: "1px solid #e5e5e5" }}>{row.docType}</td>
                      <td style={{ padding: "8px 12px", fontSize: "12px", color: "#32363a", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.total}</td>
                      <td style={{ padding: "8px 12px", fontSize: "12px", color: "#107E3E", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.uploaded}</td>
                      <td style={{ padding: "8px 12px", fontSize: "12px", color: "#E9730C", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.pending}</td>
                      <td style={{ padding: "8px 12px", fontSize: "12px", color: row.missing > 0 ? "#BB0000" : "#32363a", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.missing}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full overflow-hidden" style={{ height: "6px", minWidth: "90px" }}>
                            <div
                              style={{
                                height: "100%",
                                width: row.compliance,
                                backgroundColor: parseInt(row.compliance, 10) >= 90 ? "#107E3E" : "#E9730C",
                                borderRadius: "2px",
                              }}
                            />
                          </div>
                          <span style={{ fontSize: "11px", color: parseInt(row.compliance, 10) >= 90 ? "#107E3E" : "#E9730C", fontWeight: "600", whiteSpace: "nowrap" }}>
                            {row.compliance}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
              <SectionCard title="Monthly Document Volume" badge={monthlyData.length ? `${monthlyData.length} time bucket(s)` : "No records in current range"}>
                <div className="px-4 pt-3 flex justify-end">
                  <div className="flex gap-1">
                    {(["bar", "line"] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setActiveChart(type)}
                        className="px-3 py-1 border capitalize"
                        style={{ fontSize: "11px", backgroundColor: activeChart === type ? "#0070F2" : "#ffffff", color: activeChart === type ? "#ffffff" : "#32363a", borderColor: activeChart === type ? "#0070F2" : "#d9d9d9", borderRadius: "8px", fontWeight: "600" }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4" style={{ height: "320px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {activeChart === "bar" ? (
                      <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6a6d70" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#6a6d70" }} />
                        <Tooltip contentStyle={{ fontSize: "11px", border: "1px solid #d9d9d9", borderRadius: "8px" }} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        <Bar dataKey="PR" fill="#0070F2" maxBarSize={20} />
                        <Bar dataKey="PO" fill="#107E3E" maxBarSize={20} />
                        <Bar dataKey="GRN" fill="#E9730C" maxBarSize={20} />
                        <Bar dataKey="INV" fill="#6A6D70" maxBarSize={20} />
                      </BarChart>
                    ) : (
                      <LineChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6a6d70" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#6a6d70" }} />
                        <Tooltip contentStyle={{ fontSize: "11px", border: "1px solid #d9d9d9", borderRadius: "8px" }} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        <Line type="monotone" dataKey="PR" stroke="#0070F2" strokeWidth={1.5} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="PO" stroke="#107E3E" strokeWidth={1.5} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="GRN" stroke="#E9730C" strokeWidth={1.5} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="INV" stroke="#6A6D70" strokeWidth={1.5} dot={{ r: 3 }} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Upload Status Distribution" badge="Current report scope">
              <div className="p-4 flex flex-col items-center" style={{ height: "320px" }}>
                <ResponsiveContainer width="100%" height="72%">
                  <PieChart>
                    <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={54} outerRadius={84} dataKey="value" paddingAngle={2}>
                      {statusDistribution.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "8px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 w-full mt-2">
                  {statusDistribution.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div style={{ width: "10px", height: "10px", backgroundColor: item.color, borderRadius: "999px" }} />
                        <span style={{ fontSize: "11px", color: "#32363a" }}>{item.name}</span>
                      </div>
                      <span style={{ fontSize: "11px", fontWeight: "600", color: item.color }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Vendor-wise Document Submission"
            badge={docType !== "All" && docType !== "PO" ? "Vendor view is populated from purchase orders only" : `${vendorData.length} vendor row(s)`}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "760px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f5f5f5", borderBottom: "1px solid #d9d9d9" }}>
                    {["Vendor", "Total Documents", "On Time", "Late", "On-Time Rate"].map((column, index, arr) => (
                      <th key={column} className="text-left" style={{ padding: "8px 12px", fontSize: "12px", fontWeight: "600", color: "#32363a", borderRight: index === arr.length - 1 ? "none" : "1px solid #e5e5e5", whiteSpace: "nowrap" }}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vendorData.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: "18px 20px", fontSize: "12px", color: "#8a8b8c", textAlign: "center" }}>
                        No vendor data is available for the current date range and document type.
                      </td>
                    </tr>
                  ) : vendorData.map((row, index) => {
                    const rate = row.documents > 0 ? Math.round((row.onTime / row.documents) * 100) : 0;
                    const tone = statusTone(rate >= 90 ? "VALID" : "REVIEW");
                    return (
                      <tr key={row.vendor} style={{ borderBottom: "1px solid #eeeeee", backgroundColor: index % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                        <td style={{ padding: "8px 12px", fontSize: "12px", color: "#32363a", fontWeight: "500", borderRight: "1px solid #e5e5e5" }}>{row.vendor}</td>
                        <td style={{ padding: "8px 12px", fontSize: "12px", color: "#32363a", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.documents}</td>
                        <td style={{ padding: "8px 12px", fontSize: "12px", color: "#107E3E", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.onTime}</td>
                        <td style={{ padding: "8px 12px", fontSize: "12px", color: row.late > 0 ? "#BB0000" : "#107E3E", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.late}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <div className="flex items-center gap-2">
                            <div style={{ width: "96px", height: "6px", backgroundColor: "#e5e5e5", borderRadius: "999px", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${rate}%`, backgroundColor: tone.color }} />
                            </div>
                            <span style={{ fontSize: "11px", fontWeight: "600", color: tone.color }}>{rate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
