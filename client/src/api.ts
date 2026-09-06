const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export async function checkSystem(): Promise<SystemStatus> {
  const healthRes = await fetch(`${API_URL}/api/health`);
  if (!healthRes.ok) throw new Error("Backend is unavailable");

  const categoriesRes = await fetch(`${API_URL}/api/categories`);
  if (!categoriesRes.ok) throw new Error("Backend is unavailable");
  const categories: Category[] = await categoriesRes.json();

  return { online: true, categories };
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export type Priority = "LOW" | "MEDIUM" | "HIGH";

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/api/categories`);
  if (!res.ok) throw new Error("Unable to load categories");
  return res.json();
}

export async function fetchRelatedSystems(): Promise<RelatedSystem[]> {
  const res = await fetch(`${API_URL}/api/related-systems`);
  if (!res.ok) throw new Error("Unable to load related systems");
  return res.json();
}

export interface CreateTicketPayload {
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: Priority;
}

export interface CreateTicketResult {
  id: number;
  ticketNumber: string;
  [key: string]: unknown;
}

export async function createTicket(payload: CreateTicketPayload): Promise<CreateTicketResult> {
  const res = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 400 && body.fields) {
      const err = new Error("Validation failed") as Error & { fields?: Record<string, string> };
      err.fields = body.fields;
      throw err;
    }
    throw new Error("Unable to create ticket. Please try again.");
  }

  return res.json();
}

export interface Ticket {
  id: number;
  ticketNumber: string;
  summary: string;
  categoryId: number;
  requestedPriority: Priority;
  itPriority: Priority | null;
  currentStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface TicketListResult {
  data: Ticket[];
  pagination: Pagination;
}

export async function fetchTickets(params: {
  requesterId: number;
  search?: string;
  category?: number;
  requestedPriority?: string;
  status?: string;
  sortBy?: string;
  sortDir?: string;
  page?: number;
}): Promise<TicketListResult> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const res = await fetch(`${API_URL}/api/tickets?${query.toString()}`);
  if (!res.ok) throw new Error("Unable to load tickets");
  return res.json();
}

export interface Attachment {
  id: number;
  filename: string;
  sizeBytes: number;
  uploadedAt: string;
  removedAt: string | null;
  removedReason: string | null;
}

export interface TicketDetail extends Ticket {
  description: string;
  attachments: Attachment[];
}

export async function fetchTicketDetail(ticketId: number, requesterId: number): Promise<TicketDetail> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}?requesterId=${requesterId}`);
  if (!res.ok) throw new Error("Unable to load ticket");
  return res.json();
}

export async function uploadAttachment(ticketId: number, requesterId: number, file: File): Promise<Attachment> {
  const formData = new FormData();
  formData.append("requesterId", String(requesterId));
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Unable to upload attachment");
  }
  return res.json();
}

export async function removeAttachment(attachmentId: number, requesterId: number, reason: string): Promise<Attachment> {
  const res = await fetch(`${API_URL}/api/attachments/${attachmentId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requesterId, reason }),
  });
  if (!res.ok) throw new Error("Unable to remove attachment");
  return res.json();
}

export function downloadAttachmentUrl(attachmentId: number, requesterId: number): string {
  return `${API_URL}/api/attachments/${attachmentId}/download?requesterId=${requesterId}`;
}