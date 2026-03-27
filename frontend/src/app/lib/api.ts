import type {
  ApiEnvelope,
  DashboardSummary,
  FrontendStageKey,
  GRNRecord,
  InvoiceAggregate,
  InvoiceRecord,
  NotificationItem,
  PORecord,
  PRRecord,
  RecentActivityItem,
  StageDocument,
  StageKey,
  StageStatusRecord,
  ValueHelpItem,
} from "./types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const DEFAULT_UPLOADER = import.meta.env.VITE_DEFAULT_UPLOADER || "frontend.user";

const ROUTE_MAP: Record<StageKey, string> = {
  PR: "pr",
  PO: "po",
  GRN: "grn",
  INVOICE: "invoice",
};

const STAGE_PARAM_MAP: Record<StageKey, string> = {
  PR: "pr_number",
  PO: "po_number",
  GRN: "grn_number",
  INVOICE: "invoice_number",
};

function buildUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildUrl(path), init);
  let payload: ApiEnvelope<T> | null = null;

  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || `Request failed with status ${response.status}`);
  }

  return payload.data;
}

export function buildApiAssetUrl(path: string) {
  return buildUrl(path);
}

export function getStageFromFrontend(stage: FrontendStageKey): StageKey {
  return stage === "INV" ? "INVOICE" : stage;
}

export function getReferenceLabel(stage: FrontendStageKey) {
  return stage === "INV" ? "Invoice Number" : `${stage} Number`;
}

export async function getDashboardSummary() {
  return request<DashboardSummary>("/dashboard/summary");
}

export async function getDashboardStages() {
  return request<Record<StageKey, StageStatusRecord[]>>("/dashboard/stages");
}

export async function getRecentActivity(limit = 10) {
  return request<{ activities: RecentActivityItem[]; count: number }>(`/dashboard/recent-activity?limit=${limit}`);
}

export async function getNotifications(limit = 20, unreadOnly = false) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (unreadOnly) params.set("unread", "true");
  return request<{ notifications: NotificationItem[]; count: number }>(`/notifications/?${params.toString()}`);
}

export async function getUnreadNotificationCount() {
  return request<{ unread_count: number }>("/notifications/unread-count");
}

export async function markNotificationRead(notificationId: string) {
  return request<null>(`/notifications/${notificationId}/read`, { method: "PUT" });
}

export async function markAllNotificationsRead() {
  return request<{ updated_count: number }>("/notifications/mark-all-read", { method: "PUT" });
}

export async function listValueHelp(stage: FrontendStageKey): Promise<ValueHelpItem[]> {
  if (stage === "PR") {
    const data = await request<Array<{ pr_number: string; document_type: string; status: string }>>("/master/pr-numbers");
    return data.map((item) => ({ id: item.pr_number, description: item.document_type || item.pr_number, status: item.status }));
  }
  if (stage === "PO") {
    const data = await request<Array<{ po_number: string; pr_number: string; vendor: string; status: string }>>("/master/po-numbers");
    return data.map((item) => ({ id: item.po_number, description: item.pr_number || item.po_number, vendor: item.vendor, status: item.status }));
  }
  if (stage === "GRN") {
    const data = await request<Array<{ grn_number: string; po_number: string; status: string }>>("/master/grn-numbers");
    return data.map((item) => ({ id: item.grn_number, description: item.po_number || item.grn_number, status: item.status }));
  }

  const data = await request<Array<{ invoice_number: string; pr_number: string; po_number: string; grn_number: string; status: string }>>("/master/invoice-numbers");
  return data.map((item) => ({
    id: item.invoice_number,
    description: [item.pr_number, item.po_number, item.grn_number].filter((value): value is string => Boolean(value)).join(" • ") || item.invoice_number,
    status: item.status,
  }));
}

export async function listStageRecords(stage: StageKey) {
  const route = ROUTE_MAP[stage];
  if (stage === "PR") {
    return request<PRRecord[]>(`/${route}/`);
  }
  if (stage === "PO") {
    return request<PORecord[]>(`/${route}/`);
  }
  if (stage === "GRN") {
    return request<GRNRecord[]>(`/${route}/`);
  }
  return request<InvoiceRecord[]>(`/${route}/`);
}

export async function getStageRecord(stage: StageKey, referenceNumber: string) {
  const route = ROUTE_MAP[stage];
  if (stage === "PR") {
    return request<PRRecord>(`/${route}/${referenceNumber}`);
  }
  if (stage === "PO") {
    return request<PORecord>(`/${route}/${referenceNumber}`);
  }
  if (stage === "GRN") {
    return request<GRNRecord>(`/${route}/${referenceNumber}`);
  }
  return request<InvoiceAggregate>(`/${route}/${referenceNumber}`);
}

export async function listDocuments(stage: StageKey, referenceNumber: string) {
  const route = ROUTE_MAP[stage];
  const param = STAGE_PARAM_MAP[stage];
  if (stage === "PR") {
    return request<{ pr_number: string; documents: StageDocument[]; count: number }>(`/${route}/${referenceNumber}/documents`);
  }
  if (stage === "PO") {
    return request<{ po_number: string; document: StageDocument | null; count: number }>(`/${route}/${referenceNumber}/documents`);
  }
  if (stage === "GRN") {
    return request<{ grn_number: string; document: StageDocument | null; count: number }>(`/${route}/${referenceNumber}/documents`);
  }
  const data = await request<{ invoice_number: string; document: StageDocument | null; count: number }>(`/${route}/${referenceNumber}/documents`);
  return { ...data, [param]: referenceNumber };
}

export async function uploadDocuments(stage: StageKey, referenceNumber: string, files: File[]) {
  const route = ROUTE_MAP[stage];
  const formData = new FormData();
  files.forEach((file) => {
    formData.append(stage === "PR" ? "files" : "file", file);
  });
  formData.append("uploaded_by", DEFAULT_UPLOADER);

  if (stage === "PR") {
    return request<{
      pr_number: string;
      uploaded: Array<{
        document_id: string;
        original_filename: string;
        stored_filename: string;
        file_size_bytes: number;
        mime_type: string;
        ocr_status: string;
        ocr_rejection_detail?: StageDocument["ocr_rejection_detail"];
        version: number;
        uploaded_by: string;
        uploaded_at: string;
      }>;
      uploaded_count: number;
      errors: Array<{ filename?: string; reason?: string; error?: string }>;
      error_count: number;
    }>(`/${route}/${referenceNumber}/documents/upload`, {
      method: "POST",
      body: formData,
    });
  }

  return request<StageDocument>(`/${route}/${referenceNumber}/documents/upload`, {
    method: "POST",
    body: formData,
  });
}

export async function replaceDocument(stage: StageKey, referenceNumber: string, documentId: string, file: File) {
  const route = ROUTE_MAP[stage];
  const formData = new FormData();
  formData.append("file", file);
  formData.append("uploaded_by", DEFAULT_UPLOADER);

  return request<StageDocument>(`/${route}/${referenceNumber}/documents/${documentId}/change`, {
    method: "PUT",
    body: formData,
  });
}

export async function deleteDocument(stage: StageKey, documentId: string) {
  const route = ROUTE_MAP[stage];
  return request<null>(`/${route}/documents/${documentId}`, {
    method: "DELETE",
  });
}

export function getDocumentDownloadUrl(stage: StageKey, documentId: string, inline = false) {
  const route = ROUTE_MAP[stage];
  return buildApiAssetUrl(`/${route}/documents/${documentId}/download${inline ? "?inline=true" : ""}`);
}

export async function sendInvoiceToMiro(invoiceNumber: string) {
  return request<{ miro_redirect_url: string; status: string }>(`/invoice/${invoiceNumber}/miro-redirect`, {
    method: "POST",
  });
}
