export function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function formatCurrency(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatFileSize(bytes?: number | null) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function statusTone(status?: string | null) {
  const normalized = (status || "").toUpperCase();
  if (["VALID", "APPROVED", "ACCEPTED", "POSTED", "COMPLETED", "SENT_TO_MIRO", "CLOSED"].includes(normalized)) {
    return { color: "#107E3E", bg: "#EEF5EC" };
  }
  if (["REVIEW", "PENDING", "IN_PROGRESS"].includes(normalized)) {
    return { color: "#E9730C", bg: "#FEF3E8" };
  }
  if (["INVALID", "REJECTED", "MISSING", "ERROR"].includes(normalized)) {
    return { color: "#BB0000", bg: "#FBEAEA" };
  }
  return { color: "#0070F2", bg: "#E8F1FB" };
}
