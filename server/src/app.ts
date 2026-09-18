import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { getPrisma } from "./prisma.js";
import { generateTicketNumber } from "./ticketNumber.js";
import multer from "multer";
import fs from "fs";
import authRoutes from "./authRoutes.js";
import { authMiddleware, AuthRequest } from "./authMiddleware.js";
void getPrisma;

const MAX_PUBLIC_COMMENT_LENGTH = 1000;

function getRequesterIdFromRequest(req: AuthRequest): number | undefined {
  if (req.user?.id) return req.user.id;

  const candidate = req.body?.requesterId ?? req.query?.requesterId;
  if (candidate === undefined || candidate === null || candidate === "") return undefined;

  const parsed = Number(candidate);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function validatePublicComment(content: unknown) {
  const trimmed = typeof content === "string" ? content.trim() : "";
  if (!trimmed) return { valid: false, message: "Comment content is required." };
  if (trimmed.length > MAX_PUBLIC_COMMENT_LENGTH) {
    return { valid: false, message: `Comment must be ${MAX_PUBLIC_COMMENT_LENGTH} characters or fewer.` };
  }
  return { valid: true, value: trimmed };
}

export const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.use("/api/auth", authRoutes);

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(categories);
  } catch (err) {
    res.status(500).json({ error: "Unable to retrieve categories" });
  }
});

app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesters = await prisma.user.findMany({
      where: { isActive: true, role: "REQUESTER" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
    res.status(200).json(requesters);
  } catch (err) {
    console.error("GET /api/requesters failed:", err);
    res.status(500).json({ error: "Unable to retrieve requesters" });
  }
});

app.get("/api/related-systems", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const systems = await prisma.relatedSystem.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    res.status(200).json(systems);
  } catch (err) {
    res.status(500).json({ error: "Unable to retrieve related systems" });
  }
});

app.post("/api/tickets", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterId = getRequesterIdFromRequest(req);
    if (!requesterId) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
    }

    if (req.user?.role !== "REQUESTER") {
      return res.status(403).json({ error: "FORBIDDEN", message: "Only requesters can create tickets" });
    }

    const { categoryId, relatedSystemId, summary, description, requestedPriority } = req.body;

    const trimmedSummary = (summary ?? "").trim();
    const trimmedDescription = (description ?? "").trim();
    const fields: Record<string, string> = {};

    if (trimmedSummary.length < 5 || trimmedSummary.length > 150) {
      fields.summary = "Summary is required (5-150 characters).";
    }
    if (trimmedDescription.length < 10 || trimmedDescription.length > 2000) {
      fields.description = "Description is required (10-2000 characters).";
    }
    if (!["LOW", "MEDIUM", "HIGH"].includes(requestedPriority)) {
      fields.requestedPriority = "Requested priority must be LOW, MEDIUM, or HIGH.";
    }

    if (Object.keys(fields).length > 0) {
      return res.status(400).json({ error: "VALIDATION_ERROR", fields });
    }

    const category = await prisma.category.findFirst({ where: { id: categoryId } });
    const relatedSystem = await prisma.relatedSystem.findFirst({ where: { id: relatedSystemId, isActive: true } });
    if (!category || !relatedSystem) {
      return res.status(404).json({ error: "Category or Related System not found" });
    }

    let ticket;
    let attempts = 0;
    while (!ticket) {
      attempts++;
      const count = await prisma.ticket.count();
      const ticketNumber = generateTicketNumber(count + attempts);
      try {
        ticket = await prisma.ticket.create({
          data: {
            ticketNumber,
            requesterId,
            categoryId,
            relatedSystemId,
            summary: trimmedSummary,
            description: trimmedDescription,
            requestedPriority,
          },
        });
      } catch (err: unknown) {
        const isUniqueViolation = (err as { code?: string }).code === "P2002";
        if (!isUniqueViolation || attempts >= 5) throw err;
      }
    }

    res.status(201).json(ticket);
  } catch (err) {
    console.error("POST /api/tickets failed:", err);
    res.status(500).json({ error: "Unable to create ticket" });
  }
});

app.get("/api/tickets", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterId = getRequesterIdFromRequest(req);
    if (!requesterId) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
    }

    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const category = req.query.category ? Number(req.query.category) : undefined;
    const requestedPriority = typeof req.query.requestedPriority === "string" ? req.query.requestedPriority : undefined;
    const itPriority = typeof req.query.itPriority === "string" ? req.query.itPriority : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;

    const sortByRaw = typeof req.query.sortBy === "string" ? req.query.sortBy : "createdAt";
    const sortBy = ["createdAt", "updatedAt"].includes(sortByRaw) ? sortByRaw : "createdAt";
    const sortDirRaw = typeof req.query.sortDir === "string" ? req.query.sortDir : "desc";
    const sortDir = ["asc", "desc"].includes(sortDirRaw) ? sortDirRaw : "desc";

    let page = Number(req.query.page);
    if (!Number.isInteger(page) || page < 1) page = 1;
    let pageSize = Number(req.query.pageSize);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) pageSize = 10;

    const where: Record<string, unknown> = { requesterId };
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
      ];
    }
    if (category) where.categoryId = category;
    if (requestedPriority) where.requestedPriority = requestedPriority;
    if (itPriority) where.itPriority = itPriority;
    if (status) where.currentStatus = status;

    const [data, totalItems] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ticket.count({ where }),
    ]);

    res.status(200).json({
      data,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize) || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Unable to retrieve tickets" });
  }
});

app.get("/api/tickets/queue", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const role = req.user?.role;
    if (role !== "IT_STAFF" && role !== "ADMINISTRATOR") {
      return res.status(403).json({ error: "FORBIDDEN", message: "Only IT Staff and administrators can access the ticket queue" });
    }

    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const itPriority = typeof req.query.itPriority === "string" ? req.query.itPriority : undefined;
    const ownerIdRaw = req.query.ownerId;
    let ownerId: number | undefined;
    if (ownerIdRaw !== undefined && ownerIdRaw !== null && ownerIdRaw !== "") {
      const parsedOwnerId = Number(ownerIdRaw);
      if (!Number.isInteger(parsedOwnerId) || parsedOwnerId <= 0) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: "Owner filter must be a positive integer" });
      }
      ownerId = parsedOwnerId;
    }

    const sortByRaw = typeof req.query.sortBy === "string" ? req.query.sortBy : "updatedAt";
    const allowedSortBy = ["createdAt", "updatedAt", "itPriority"];
    if (!allowedSortBy.includes(sortByRaw)) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid sortBy parameter" });
    }
    const sortBy = sortByRaw;

    const sortDirRaw = typeof req.query.sortDir === "string" ? req.query.sortDir : "desc";
    const sortDir = ["asc", "desc"].includes(sortDirRaw) ? sortDirRaw : "desc";

    let page = Number(req.query.page);
    if (!Number.isInteger(page) || page < 1) page = 1;
    let pageSize = Number(req.query.pageSize);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) pageSize = 10;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status) where.currentStatus = status;
    if (itPriority) where.itPriority = itPriority;
    if (ownerId !== undefined) where.ownerId = ownerId;

    const [data, totalItems] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: sortBy === "itPriority" ? { itPriority: sortDir } : { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          requester: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    res.status(200).json({
      data: data.map((ticket) => ({
        ...ticket,
        requesterName: ticket.requester.name,
        ownerName: ticket.owner?.name ?? null,
      })),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize) || 0,
      },
    });
  } catch (err) {
    console.error("GET /api/tickets/queue failed:", err);
    res.status(500).json({ error: "Unable to retrieve ticket queue" });
  }
});

app.get("/api/tickets/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketId = Number(req.params.id);
    const requesterId = getRequesterIdFromRequest(req);

    if (!requesterId) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        attachments: true,
        category: true,
        relatedSystem: true,
        publicComments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true } } },
        },
      },
    });

    if (!ticket || ticket.requesterId !== requesterId) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.status(200).json(ticket);
  } catch (err) {
    console.error("GET /api/tickets/:id", err);
    res.status(500).json({ error: "Unable to retrieve ticket" });
  }
});

app.get("/api/tickets/:id/comments", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketId = Number(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || (ticket.requesterId !== userId && !["IT_STAFF", "ADMINISTRATOR"].includes(req.user?.role ?? ""))) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const comments = await prisma.publicComment.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, name: true } } },
    });

    res.status(200).json(comments);
  } catch (err) {
    res.status(500).json({ error: "Unable to retrieve comments" });
  }
});

app.post("/api/tickets/:id/comments", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketId = Number(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || (ticket.requesterId !== userId && !["IT_STAFF", "ADMINISTRATOR"].includes(req.user?.role ?? ""))) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const validation = validatePublicComment(req.body?.content);
    if (!validation.valid) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: validation.message });
    }

    const comment = await prisma.publicComment.create({
      data: {
        ticketId,
        authorId: userId,
        content: validation.value!,
      },
    });

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: "Unable to create comment" });
  }
});

app.patch("/api/tickets/:id/requester-resolved", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketId = Number(req.params.id);
    const userId = req.user?.id;

    if (!userId || req.user?.role !== "REQUESTER") {
      return res.status(403).json({ error: "FORBIDDEN", message: "Only requesters can mark a ticket as appears resolved" });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.requesterId !== userId) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { currentStatus: "WAITING_FOR_REQUESTER" },
    });

    res.status(200).json(updatedTicket);
  } catch (err) {
    res.status(500).json({ error: "Unable to update ticket status" });
  }
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, "uploads"),
    filename: (_req, file, cb) => {
      const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      cb(null, safeName);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    cb(null, allowed.includes(file.mimetype));
  },
});

app.post("/api/tickets/:id/attachments", upload.single("file"), authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketId = Number(req.params.id);
    const requesterId = getRequesterIdFromRequest(req);

    if (!requesterId) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.requesterId !== requesterId) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Unsupported file type or missing file" });
    }

    const activeCount = await prisma.attachment.count({
      where: { ticketId, removedAt: null },
    });
    if (activeCount >= 5) {
      fs.unlinkSync(req.file.path);
      return res.status(409).json({ error: "Ticket already has 5 active attachments" });
    }

    const attachment = await prisma.attachment.create({
      data: {
        ticketId,
        filename: req.file.originalname,
        storedPath: req.file.path,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      },
    });

    res.status(201).json(attachment);
  } catch (err) {
    console.error("POST /api/tickets/:id/attachments", err);
    res.status(500).json({ error: "Unable to upload attachment" });
  }
});

app.get("/api/attachments/:id/download", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const attachmentId = Number(req.params.id);
    const requesterId = getRequesterIdFromRequest(req);

    if (!requesterId) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: true },
    });

    if (!attachment || attachment.ticket.requesterId !== requesterId) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    if (attachment.removedAt) {
      return res.status(410).json({ error: "This attachment has been removed" });
    }

    res.download(attachment.storedPath, attachment.filename);
  } catch (err) {
    console.error("GET /api/attachments/:id/download", err);
    res.status(500).json({ error: "Unable to download attachment" });
  }
});

app.delete("/api/attachments/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const attachmentId = Number(req.params.id);
    const requesterId = getRequesterIdFromRequest(req);
    const { reason } = req.body;

    if (!requesterId) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "A removal reason is required" });
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: true },
    });

    if (!attachment || attachment.ticket.requesterId !== requesterId) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    if (attachment.removedAt) {
      return res.status(409).json({ error: "Attachment already removed" });
    }

    const updated = await prisma.attachment.update({
      where: { id: attachmentId },
      data: { removedAt: new Date(), removedReason: reason.trim() },
    });

    res.status(200).json(updated);
  } catch (err) {
    console.error("DELETE /api/attachments/:id", err);
    res.status(500).json({ error: "Unable to remove attachment" });
  }
});

export default app;
