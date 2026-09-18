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
    credentials: "include",
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
  const res = await fetch(`${API_URL}/api/tickets?${query.toString()}`, { credentials: "include" });
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

export interface PublicComment {
  id: number;
  ticketId: number;
  authorId: number;
  content: string;
  createdAt: string;
}

export interface TicketDetail extends Ticket {
  description: string;
  attachments: Attachment[];
  comments?: PublicComment[];
}

export interface TicketQueueEntry extends Ticket {
  requesterId: number;
  ownerId: number | null;
  requesterName: string;
  ownerName: string | null;
}

export interface TicketQueueResult {
  data: TicketQueueEntry[];
  pagination: Pagination;
}

export async function fetchTicketQueue(params: {
  search?: string;
  status?: string;
  itPriority?: string;
  ownerId?: number;
  sortBy?: "createdAt" | "updatedAt" | "itPriority";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}): Promise<TicketQueueResult> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });

  const res = await fetch(`${API_URL}/api/tickets/queue?${query.toString()}`, { credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.message || "Unable to load ticket queue";
    const error = new Error(message) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export async function fetchTicketDetail(ticketId: number, _requesterId?: number): Promise<TicketDetail> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}`, { credentials: "include" });
  if (!res.ok) throw new Error("Unable to load ticket");
  return res.json();
}

export async function fetchTicketComments(ticketId: number): Promise<PublicComment[]> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, { credentials: "include" });
  if (!res.ok) throw new Error("Unable to load comments");
  return res.json();
}

export async function createTicketComment(ticketId: number, content: string): Promise<PublicComment> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Unable to post comment");
  }
  return res.json();
}

export async function markTicketAppearsResolved(ticketId: number): Promise<TicketDetail> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/requester-resolved`, {
    method: "PATCH",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Unable to update ticket status");
  }
  return res.json();
}

export async function uploadAttachment(ticketId: number, requesterIdOrFile: number | File, maybeFile?: File): Promise<Attachment> {
  const file = typeof requesterIdOrFile === "number" ? (maybeFile ?? new File([], "")) : requesterIdOrFile;

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Unable to upload attachment");
  }
  return res.json();
}

export async function removeAttachment(attachmentId: number, requesterIdOrReason: number | string, maybeReason?: string): Promise<Attachment> {
  const reason = typeof requesterIdOrReason === "number" ? (maybeReason ?? "") : requesterIdOrReason;

  const res = await fetch(`${API_URL}/api/attachments/${attachmentId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error("Unable to remove attachment");
  return res.json();
}

export function downloadAttachmentUrl(attachmentId: number, _requesterId?: number): string {
  return `${API_URL}/api/attachments/${attachmentId}/download`;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  requiresPasswordChange: boolean;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Invalid email or password");
  }
  const data = await res.json();
  return data.user;
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
}

export async function getMe(): Promise<AuthUser | null> {
  const res = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Unable to change password");
  }
}