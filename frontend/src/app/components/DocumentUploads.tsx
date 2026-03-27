import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { GRNModule } from "./modules/GRNModule";
import { InvoiceModule } from "./modules/InvoiceModule";
import { POModule } from "./modules/POModule";
import { PRModule } from "./modules/PRModule";

const MAIN_TABS = [
  { id: "PR", label: "Purchase Requisition (PR)" },
  { id: "PO", label: "Purchase Orders (PO)" },
  { id: "GRN", label: "Goods Receipt Note (GRN)" },
  { id: "INV", label: "Invoice Verification" },
] as const;

export function DocumentUploads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const defaultTab = useMemo(() => (MAIN_TABS.some((tab) => tab.id === requestedTab) ? requestedTab! : "PR"), [requestedTab]);
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const changeTab = (tab: string) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-3 border-b flex items-center justify-between flex-shrink-0" style={{ backgroundColor: "#ffffff", borderColor: "#d9d9d9" }}>
        <div>
          <div style={{ fontSize: "11px", color: "#8a8b8c" }}>Home &rsaquo; Document Verification</div>
          <h1 style={{ fontSize: "16px", fontWeight: "600", color: "#32363a", margin: 0 }}>Invoice Verification</h1>
        </div>
      </div>

      <div className="flex border-b flex-shrink-0" style={{ backgroundColor: "#ffffff", borderColor: "#d9d9d9" }}>
        {MAIN_TABS.map((tab) => (
          <button key={tab.id} onClick={() => changeTab(tab.id)} className="px-5 py-2 relative border-r" style={{ fontSize: "12px", fontWeight: activeTab === tab.id ? "600" : "400", color: activeTab === tab.id ? "#0070F2" : "#32363a", backgroundColor: activeTab === tab.id ? "#ffffff" : "#f5f5f5", borderColor: "#d9d9d9", borderBottom: activeTab === tab.id ? "2px solid #0070F2" : "2px solid transparent", whiteSpace: "nowrap" }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "PR" && <PRModule />}
        {activeTab === "PO" && <POModule />}
        {activeTab === "GRN" && <GRNModule />}
        {activeTab === "INV" && <InvoiceModule />}
      </div>
    </div>
  );
}
