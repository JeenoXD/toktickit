import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { generateTicketNumber } from "./ticketNumber.js";
void getPrisma;

export const app = express();

app.use(cors());  
app.use(express.json());

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
    const requesters = await prisma.requesterUser.findMany({
      where: { isActive: true },
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

app.post("/api/tickets", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const { requesterId, categoryId, relatedSystemId, summary, description, requestedPriority } = req.body;

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

    const count = await prisma.ticket.count();
    const ticketNumber = generateTicketNumber(count + 1);

    const ticket = await prisma.ticket.create({
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

    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ error: "Unable to create ticket" });
  }
});

app.get("/api/tickets", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterId = Number(req.query.requesterId);
    if (!requesterId) {
      return res.status(400).json({ error: "requesterId is required" });
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

export default app;
