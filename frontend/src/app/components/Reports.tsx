import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, RefreshCw } from "lucide-react";
import { getDashboardSummary, listStageRecords } from "../lib/api";
import { formatDate, statusTone } from "../lib/format";
import type { DashboardSummary, GRNRecord, InvoiceRecord, PORecord, PRRecord } from "../lib/types";

type SummaryReportRow = { docType: string; total: number; uploaded: number; pending: number; missing: number; compliance: string };

type MonthlyBucket = { month: string; PR: number; PO: number; GRN: number; INV: number };

export function Reports() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [records, setRecords] = useState<{ PR: PRRecord[]; PO: PORecord[]; GRN: GRNRecord[]; INV: InvoiceRecord[] } | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [docType, setDocType] = useState("All");
  const [activeChart, setActiveChart] = useState<"bar" | "line">("bar");
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

  useEffect(() => { void loadData(); }, []);

  const summaryReport = useMemo<SummaryReportRow[]>(() => {
    if (!summary) return [];
    const rows: SummaryReportRow[] = [
      { key: "PR", label: "Purchase Requisition (PR)" },
      { key: "PO", label: "Purchase Order (PO)" },
      { key: "GRN", label: "Goods Receipt Note (GRN)" },
      { key: "INVOICE", label: "Invoice Verification" },
    ].map(({ key, label }) => {
      const stage = summary.document_upload_status[key as keyof DashboardSummary["document_upload_status"]];
      const pending = stage.total - stage.with_docs - stage.missing;
      const compliance = stage.total > 0 ? `${Math.round((stage.with_docs / stage.total) * 100)}%` : "0%";
      return { docType: label, total: stage.total, uploaded: stage.with_docs, pending, missing: stage.missing, compliance };
    });
    const total = rows.reduce((acc, row) => ({ docType: "Total", total: acc.total + row.total, uploaded: acc.uploaded + row.uploaded, pending: acc.pending + row.pending, missing: acc.missing + row.missing, compliance: "0%" }), { docType: "Total", total: 0, uploaded: 0, pending: 0, missing: 0, compliance: "0%" });
    total.compliance = total.total > 0 ? `${Math.round((total.uploaded / total.total) * 100)}%` : "0%";
    return [...rows, total];
  }, [summary]);

  const statusDistribution = useMemo(() => {
    if (!summary) return [];
    const uploaded = Object.values(summary.document_upload_status).reduce((sum, item) => sum + item.with_docs, 0);
    const missing = Object.values(summary.document_upload_status).reduce((sum, item) => sum + item.missing, 0);
    const pending = Object.values(summary.document_upload_status).reduce((sum, item) => sum + Math.max(item.total - item.with_docs - item.missing, 0), 0);
    return [
      { name: "Uploaded", value: uploaded, color: "#107E3E" },
      { name: "Pending", value: pending, color: "#E9730C" },
      { name: "Missing", value: missing, color: "#BB0000" },
    ];
  }, [summary]);

  const monthlyData = useMemo<MonthlyBucket[]>(() => {
    if (!records) return [];
    const buckets = new Map<string, MonthlyBucket>();
    const addBucket = (label: string) => {
      if (!buckets.has(label)) buckets.set(label, { month: label, PR: 0, PO: 0, GRN: 0, INV: 0 });
      return buckets.get(label)!;
    };

    records.PR.forEach((record) => { const label = new Date(record.created_at).toLocaleString(undefined, { month: "short", year: "2-digit" }); addBucket(label).PR += 1; });
    records.PO.forEach((record) => { const label = new Date(record.created_at).toLocaleString(undefined, { month: "short", year: "2-digit" }); addBucket(label).PO += 1; });
    records.GRN.forEach((record) => { const label = new Date(record.created_at).toLocaleString(undefined, { month: "short", year: "2-digit" }); addBucket(label).GRN += 1; });
    records.INV.forEach((record) => { const label = new Date(record.created_at).toLocaleString(undefined, { month: "short", year: "2-digit" }); addBucket(label).INV += 1; });

    return Array.from(buckets.values());
  }, [records]);

  const vendorData = useMemo(() => {
    if (!records) return [];
    const vendors = new Map<string, { vendor: string; documents: number; onTime: number; late: number }>();
    records.PO.forEach((record) => {
      const current = vendors.get(record.vendor) || { vendor: record.vendor, documents: 0, onTime: 0, late: 0 };
      current.documents += 1;
      if (record.status === "OPEN" || record.status === "CLOSED") current.onTime += 1;
      else current.late += 1;
      vendors.set(record.vendor, current);
    });
    return Array.from(vendors.values());
  }, [records]);

  if (loading) {
    return <div className="flex items-center justify-center h-full" style={{ color: "#6A6D70" }}>Loading reports...</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 py-3 border-b flex items-center justify-between flex-shrink-0" style={{ backgroundColor: "#ffffff", borderColor: "#d9d9d9" }}>
        <div>
          <div style={{ fontSize: "11px", color: "#8a8b8c" }}>Home &rsaquo; Reports</div>
          <h1 style={{ fontSize: "16px", fontWeight: "600", color: "#32363a", margin: 0 }}>Reports & Analytics</h1>
        </div>
        <button className="flex items-center gap-1 px-3 py-1 border hover:bg-gray-50" style={{ fontSize: "12px", borderColor: "#d9d9d9", color: "#32363a", borderRadius: "2px" }} onClick={() => window.print()}>
          <Download size={13} /> Export Report
        </button>
      </div>

      <div className="px-4 py-3 border-b flex-shrink-0" style={{ backgroundColor: "#f5f5f5", borderColor: "#d9d9d9" }}>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1"><label style={{ fontSize: "11px", fontWeight: "500", color: "#32363a" }}>Date From</label><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="border px-2 py-1 outline-none" style={{ fontSize: "12px", borderColor: "#d9d9d9", color: "#32363a", borderRadius: "2px", backgroundColor: "#ffffff", height: "26px", width: "140px" }} /></div>
          <div className="flex flex-col gap-1"><label style={{ fontSize: "11px", fontWeight: "500", color: "#32363a" }}>Date To</label><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="border px-2 py-1 outline-none" style={{ fontSize: "12px", borderColor: "#d9d9d9", color: "#32363a", borderRadius: "2px", backgroundColor: "#ffffff", height: "26px", width: "140px" }} /></div>
          <div className="flex flex-col gap-1"><label style={{ fontSize: "11px", fontWeight: "500", color: "#32363a" }}>Document Type</label><select value={docType} onChange={(event) => setDocType(event.target.value)} className="border px-2 py-1 outline-none" style={{ fontSize: "12px", borderColor: "#d9d9d9", color: "#32363a", borderRadius: "2px", backgroundColor: "#ffffff", height: "26px", width: "150px" }}><option value="All">All Types</option><option value="PR">Purchase Requisition</option><option value="PO">Purchase Order</option><option value="GRN">Goods Receipt Note</option><option value="INV">Invoice</option></select></div>
          <button className="flex items-center gap-1 px-4 py-1 border" style={{ fontSize: "12px", backgroundColor: "#0070F2", color: "#ffffff", borderColor: "#0070F2", borderRadius: "2px", height: "26px" }} onClick={() => void loadData()}><RefreshCw size={11} /> Apply Filters</button>
          <div style={{ fontSize: "11px", color: "#8a8b8c", marginLeft: "auto" }}>{dateFrom || dateTo ? `Range: ${formatDate(dateFrom)} – ${formatDate(dateTo)}` : "Live backend data"}</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        <div className="border" style={{ backgroundColor: "#ffffff", borderColor: "#d9d9d9", borderRadius: "2px" }}>
          <div className="px-4 py-2 border-b flex items-center justify-between" style={{ backgroundColor: "#f5f5f5", borderColor: "#d9d9d9" }}>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#32363a" }}>Document Compliance Summary</span>
            <span style={{ fontSize: "11px", color: "#8a8b8c" }}>Backend driven</span>
          </div>
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead><tr style={{ backgroundColor: "#f5f5f5", borderBottom: "1px solid #d9d9d9" }}>{["Document Type", "Total", "Uploaded", "Pending", "Missing", "Compliance %"].map((column) => <th key={column} className="text-left" style={{ padding: "6px 12px", fontSize: "11px", fontWeight: "600", color: "#32363a", borderRight: "1px solid #e5e5e5" }}>{column}</th>)}</tr></thead>
            <tbody>
              {summaryReport.map((row, index) => (
                <tr key={row.docType} style={{ borderBottom: "1px solid #eeeeee", backgroundColor: row.docType === "Total" ? "#f5f5f5" : index % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                  <td style={{ padding: "6px 12px", fontSize: "12px", color: "#32363a", fontWeight: row.docType === "Total" ? "600" : "400", borderRight: "1px solid #e5e5e5" }}>{row.docType}</td>
                  <td style={{ padding: "6px 12px", fontSize: "12px", color: "#32363a", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.total}</td>
                  <td style={{ padding: "6px 12px", fontSize: "12px", color: "#107E3E", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.uploaded}</td>
                  <td style={{ padding: "6px 12px", fontSize: "12px", color: "#E9730C", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.pending}</td>
                  <td style={{ padding: "6px 12px", fontSize: "12px", color: row.missing > 0 ? "#BB0000" : "#32363a", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.missing}</td>
                  <td style={{ padding: "6px 12px", borderRight: "1px solid #e5e5e5" }}>
                    <div className="flex items-center gap-2"><div className="flex-1 bg-gray-200 rounded-full overflow-hidden" style={{ height: "6px", width: "80px" }}><div style={{ height: "100%", width: row.compliance, backgroundColor: parseInt(row.compliance, 10) >= 90 ? "#107E3E" : "#E9730C", borderRadius: "2px" }} /></div><span style={{ fontSize: "11px", color: parseInt(row.compliance, 10) >= 90 ? "#107E3E" : "#E9730C", fontWeight: "600", whiteSpace: "nowrap" }}>{row.compliance}</span></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 border" style={{ backgroundColor: "#ffffff", borderColor: "#d9d9d9", borderRadius: "2px" }}>
            <div className="px-4 py-2 border-b flex items-center justify-between" style={{ backgroundColor: "#f5f5f5", borderColor: "#d9d9d9" }}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#32363a" }}>Monthly Document Volume</span>
              <div className="flex gap-1">{(["bar", "line"] as const).map((type) => <button key={type} onClick={() => setActiveChart(type)} className="px-3 py-1 border capitalize" style={{ fontSize: "11px", backgroundColor: activeChart === type ? "#0070F2" : "#ffffff", color: activeChart === type ? "#ffffff" : "#32363a", borderColor: activeChart === type ? "#0070F2" : "#d9d9d9", borderRadius: "2px" }}>{type}</button>)}</div>
            </div>
            <div className="p-4" style={{ height: "220px" }}>
              <ResponsiveContainer width="100%" height="100%">
                {activeChart === "bar" ? (
                  <BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" /><XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6a6d70" }} /><YAxis tick={{ fontSize: 10, fill: "#6a6d70" }} /><Tooltip contentStyle={{ fontSize: "11px", border: "1px solid #d9d9d9" }} /><Legend wrapperStyle={{ fontSize: "11px" }} /><Bar dataKey="PR" fill="#0070F2" maxBarSize={20} /><Bar dataKey="PO" fill="#107E3E" maxBarSize={20} /><Bar dataKey="GRN" fill="#E9730C" maxBarSize={20} /><Bar dataKey="INV" fill="#6A6D70" maxBarSize={20} /></BarChart>
                ) : (
                  <LineChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" /><XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6a6d70" }} /><YAxis tick={{ fontSize: 10, fill: "#6a6d70" }} /><Tooltip contentStyle={{ fontSize: "11px", border: "1px solid #d9d9d9" }} /><Legend wrapperStyle={{ fontSize: "11px" }} /><Line type="monotone" dataKey="PR" stroke="#0070F2" strokeWidth={1.5} dot={{ r: 3 }} /><Line type="monotone" dataKey="PO" stroke="#107E3E" strokeWidth={1.5} dot={{ r: 3 }} /><Line type="monotone" dataKey="GRN" stroke="#E9730C" strokeWidth={1.5} dot={{ r: 3 }} /><Line type="monotone" dataKey="INV" stroke="#6A6D70" strokeWidth={1.5} dot={{ r: 3 }} /></LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          <div className="border" style={{ backgroundColor: "#ffffff", borderColor: "#d9d9d9", borderRadius: "2px" }}>
            <div className="px-4 py-2 border-b" style={{ backgroundColor: "#f5f5f5", borderColor: "#d9d9d9" }}><span style={{ fontSize: "12px", fontWeight: "600", color: "#32363a" }}>Upload Status Distribution</span></div>
            <div className="p-4 flex flex-col items-center" style={{ height: "220px" }}>
              <ResponsiveContainer width="100%" height="70%"><PieChart><Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>{statusDistribution.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip contentStyle={{ fontSize: "11px" }} /></PieChart></ResponsiveContainer>
              <div className="flex flex-col gap-1 w-full mt-2">{statusDistribution.map((item) => <div key={item.name} className="flex items-center justify-between"><div className="flex items-center gap-1"><div style={{ width: "10px", height: "10px", backgroundColor: item.color, borderRadius: "1px" }} /><span style={{ fontSize: "11px", color: "#32363a" }}>{item.name}</span></div><span style={{ fontSize: "11px", fontWeight: "600", color: item.color }}>{item.value}</span></div>)}</div>
            </div>
          </div>
        </div>

        <div className="border" style={{ backgroundColor: "#ffffff", borderColor: "#d9d9d9", borderRadius: "2px" }}>
          <div className="px-4 py-2 border-b" style={{ backgroundColor: "#f5f5f5", borderColor: "#d9d9d9" }}><span style={{ fontSize: "12px", fontWeight: "600", color: "#32363a" }}>Vendor-wise Document Submission</span></div>
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead><tr style={{ backgroundColor: "#f5f5f5", borderBottom: "1px solid #d9d9d9" }}>{["Vendor", "Total Documents", "On Time", "Late", "On-Time Rate"].map((column) => <th key={column} className="text-left" style={{ padding: "6px 12px", fontSize: "11px", fontWeight: "600", color: "#32363a", borderRight: "1px solid #e5e5e5" }}>{column}</th>)}</tr></thead>
            <tbody>
              {vendorData.map((row, index) => {
                const rate = row.documents > 0 ? Math.round((row.onTime / row.documents) * 100) : 0;
                const tone = statusTone(rate >= 90 ? "VALID" : "REVIEW");
                return (
                  <tr key={row.vendor} style={{ borderBottom: "1px solid #eeeeee", backgroundColor: index % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                    <td style={{ padding: "6px 12px", fontSize: "12px", color: "#32363a", fontWeight: "500", borderRight: "1px solid #e5e5e5" }}>{row.vendor}</td>
                    <td style={{ padding: "6px 12px", fontSize: "12px", color: "#32363a", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.documents}</td>
                    <td style={{ padding: "6px 12px", fontSize: "12px", color: "#107E3E", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.onTime}</td>
                    <td style={{ padding: "6px 12px", fontSize: "12px", color: row.late > 0 ? "#BB0000" : "#107E3E", borderRight: "1px solid #e5e5e5", textAlign: "right" }}>{row.late}</td>
                    <td style={{ padding: "6px 12px", borderRight: "1px solid #e5e5e5" }}><div className="flex items-center gap-2"><div style={{ width: "80px", height: "6px", backgroundColor: "#e5e5e5", borderRadius: "2px", overflow: "hidden" }}><div style={{ height: "100%", width: `${rate}%`, backgroundColor: tone.color }} /></div><span style={{ fontSize: "11px", fontWeight: "600", color: tone.color }}>{rate}%</span></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
