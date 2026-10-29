import bcrypt from "bcrypt";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getPrisma } from "../src/prisma.js";
import { generateTicketNumber } from "../src/ticketNumber.js";

export async function resetAndSeed(): Promise<void> {
  const prisma = getPrisma();

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "ActionTaken", "TicketStatusHistory", "InternalNote", "PublicComment", "Attachment", "Ticket", "User", "RelatedSystem", "Category" RESTART IDENTITY CASCADE;`);

  const categoryNames = ["Account and Access", "Hardware", "Software", "Network"];
  const relatedSystemNames = ["Email", "Campus Wi-Fi", "VPN", "LEB2 App", "Grade Submission App", "Printer", "Corporate Laptop"];

  const defaultPasswordHash = await bcrypt.hash("TempPass123!", 10);

  const users = [
    { name: "Jennifer Anderson", email: "jennifer.anderson@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "Michael Brown", email: "michael.brown@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "Sarah Johnson", email: "sarah.johnson@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "David Lee", email: "david.lee@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "Emily Carter", email: "emily.carter@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "Inactive Test User", email: "inactive.user@example.com", role: "REQUESTER" as const, isActive: false },
    { name: "IT Support Staff", email: "it.staff@example.com", role: "IT_STAFF" as const, isActive: true },
    { name: "Carlos Mendez", email: "it.staff2@example.com", role: "IT_STAFF" as const, isActive: true },
    { name: "Aisha Rahman", email: "it.staff3@example.com", role: "IT_STAFF" as const, isActive: true },
    { name: "Former IT Staff", email: "it.staff.inactive@example.com", role: "IT_STAFF" as const, isActive: false },
    { name: "System Admin", email: "admin@example.com", role: "ADMINISTRATOR" as const, isActive: true },
  ];

  const categoryByName = new Map<string, number>();
  for (const name of categoryNames) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categoryByName.set(name, category.id);
  }

  const systemByName = new Map<string, number>();
  for (const name of relatedSystemNames) {
    const system = await prisma.relatedSystem.upsert({
      where: { name },
      update: {},
      create: { name, isActive: true },
    });
    systemByName.set(name, system.id);
  }

  const userByEmail = new Map<string, number>();
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        password: defaultPasswordHash,
        requiresPasswordChange: true,
      },
      create: { ...u, password: defaultPasswordHash, requiresPasswordChange: true },
    });
    userByEmail.set(u.email, user.id);
  }

  const ticketSeeds = [
    {
      requester: "jennifer.anderson@example.com",
      category: "Hardware",
      system: "Corporate Laptop",
      summary: "Laptop battery drains quickly",
      description: "My laptop battery is draining much faster than usual even when the system is idle.",
      requestedPriority: "MEDIUM" as const,
      itPriority: "MEDIUM" as const,
      status: "NEW" as const,
      owner: null,
    },
    {
      requester: "michael.brown@example.com",
      category: "Software",
      system: "Email",
      summary: "Outlook freezing intermittently",
      description: "Outlook freezes for several seconds at a time, several times an hour, since this week's update.",
      requestedPriority: "HIGH" as const,
      itPriority: "HIGH" as const,
      status: "OPEN" as const,
      owner: "it.staff@example.com",
    },
    {
      requester: "sarah.johnson@example.com",
      category: "Network",
      system: "VPN",
      summary: "Cannot connect to VPN",
      description: "VPN client fails to authenticate from home, works fine on campus Wi-Fi.",
      requestedPriority: "HIGH" as const,
      itPriority: "HIGH" as const,
      status: "IN_PROGRESS" as const,
      owner: "it.staff2@example.com",
    },
    {
      requester: "david.lee@example.com",
      category: "Account and Access",
      system: "Grade Submission App",
      summary: "Request access to SharePoint",
      description: "New TA needs access to the grading SharePoint site for CPE334.",
      requestedPriority: "LOW" as const,
      itPriority: "LOW" as const,
      status: "WAITING_FOR_REQUESTER" as const,
      owner: "it.staff3@example.com",
    },
    {
      requester: "jennifer.anderson@example.com",
      category: "Hardware",
      system: "Corporate Laptop",
      summary: "Docking station not detected",
      description: "External monitors and keyboard stop responding when docked, undocking and redocking fixes it temporarily.",
      requestedPriority: "MEDIUM" as const,
      itPriority: "MEDIUM" as const,
      status: "RESOLVED" as const,
      owner: "it.staff@example.com",
    },
    {
      requester: "michael.brown@example.com",
      category: "Software",
      system: "LEB2 App",
      summary: "Software installation request",
      description: "Need the LEB2 desktop client installed on my new workstation.",
      requestedPriority: "LOW" as const,
      itPriority: "LOW" as const,
      status: "CLOSED" as const,
      owner: "it.staff2@example.com",
    },
    {
      requester: "sarah.johnson@example.com",
      category: "Hardware",
      system: "Printer",
      summary: "Printer keeps showing offline",
      description: "Shared floor printer shows offline on my machine but works for others nearby.",
      requestedPriority: "MEDIUM" as const,
      itPriority: "MEDIUM" as const,
      status: "OPEN" as const,
      owner: null,
    },
    {
      requester: "david.lee@example.com",
      category: "Account and Access",
      system: "Email",
      summary: "New employee setup request",
      description: "New hire starting Monday needs an email account and campus Wi-Fi credentials provisioned.",
      requestedPriority: "LOW" as const,
      itPriority: "LOW" as const,
      status: "RESOLVED" as const,
      owner: "it.staff3@example.com",
    },
    {
      requester: "jennifer.anderson@example.com",
      category: "Network",
      system: "Email",
      summary: "Email not syncing on mobile",
      description: "Email stopped syncing on my phone after the last university mail server maintenance window.",
      requestedPriority: "MEDIUM" as const,
      itPriority: "MEDIUM" as const,
      status: "IN_PROGRESS" as const,
      owner: "it.staff@example.com",
    },
    {
      requester: "michael.brown@example.com",
      category: "Hardware",
      system: "Corporate Laptop",
      summary: "Multi-monitor not detected",
      description: "Second monitor isn't detected through the USB-C hub, worked fine last week.",
      requestedPriority: "MEDIUM" as const,
      itPriority: "MEDIUM" as const,
      status: "NEW" as const,
      owner: null,
    },
    // Lab 4 coverage: Reopened, Cancelled, unset IT Priority, urgent unassigned.
    {
      requester: "jennifer.anderson@example.com",
      category: "Network",
      system: "Campus Wi-Fi",
      summary: "Wi-Fi drops in meeting room",
      description: "Wi-Fi in meeting room 4B keeps dropping during video calls, it came back after the earlier fix.",
      requestedPriority: "HIGH" as const,
      itPriority: "HIGH" as const,
      status: "REOPENED" as const,
      owner: "it.staff@example.com",
    },
    {
      requester: "david.lee@example.com",
      category: "Hardware",
      system: "Corporate Laptop",
      summary: "Duplicate request for second monitor",
      description: "Submitted twice by mistake, the other monitor request already covers this.",
      requestedPriority: "LOW" as const,
      itPriority: "LOW" as const,
      status: "CANCELLED" as const,
      owner: null,
    },
    {
      requester: "sarah.johnson@example.com",
      category: "Hardware",
      system: "Corporate Laptop",
      summary: "Keyboard keys sticking",
      description: "Several keys on my laptop keyboard stick and repeat characters when typing.",
      requestedPriority: "LOW" as const,
      itPriority: null,
      status: "NEW" as const,
      owner: null,
    },
    {
      requester: "michael.brown@example.com",
      category: "Software",
      system: "Grade Submission App",
      summary: "Cannot open grade submission app",
      description: "The grade submission app shows a blank page after login and grades are due tomorrow.",
      requestedPriority: "HIGH" as const,
      itPriority: "HIGH" as const,
      status: "OPEN" as const,
      owner: null,
    },
  ];

  // Status path each seeded ticket took, so status history looks realistic (BR-18).
  const statusPaths: Record<string, string[]> = {
    NEW: ["NEW"],
    OPEN: ["NEW", "OPEN"],
    IN_PROGRESS: ["NEW", "OPEN", "IN_PROGRESS"],
    WAITING_FOR_REQUESTER: ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER"],
    RESOLVED: ["NEW", "OPEN", "IN_PROGRESS", "RESOLVED"],
    CLOSED: ["NEW", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
    REOPENED: ["NEW", "OPEN", "IN_PROGRESS", "RESOLVED", "REOPENED"],
    CANCELLED: ["NEW", "CANCELLED"],
  };
  const HOUR = 60 * 60 * 1000;
  const seedNow = Date.now();

  const ticketIdBySummary = new Map<string, number>();
  let sequence = 0;
  for (const t of ticketSeeds) {
    sequence += 1;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: generateTicketNumber(sequence),
        requesterId: userByEmail.get(t.requester)!,
        categoryId: categoryByName.get(t.category)!,
        relatedSystemId: systemByName.get(t.system)!,
        summary: t.summary,
        description: t.description,
        requestedPriority: t.requestedPriority,
        itPriority: t.itPriority,
        currentStatus: t.status,
        ownerId: t.owner ? userByEmail.get(t.owner)! : null,
        // Older tickets first, 12 hours apart, so seeded resolutions fall inside the
        // dashboard's 7-day "recent" window.
        createdAt: new Date(seedNow - (ticketSeeds.length - sequence + 1) * 12 * HOUR),
      },
    });
    ticketIdBySummary.set(t.summary, ticket.id);

    const path = statusPaths[t.status];
    const changedBy = t.owner ? userByEmail.get(t.owner)! : userByEmail.get("it.staff@example.com")!;
    let resolvedAt: Date | null = null;
    for (let i = 0; i < path.length; i += 1) {
      const changedAt = new Date(ticket.createdAt.getTime() + i * 2 * HOUR);
      if (path[i] === "RESOLVED") resolvedAt = changedAt;
      await prisma.ticketStatusHistory.create({
        data: {
          ticketId: ticket.id,
          fromStatus: i === 0 ? null : (path[i - 1] as typeof t.status),
          toStatus: path[i] as typeof t.status,
          changedById: i === 0 ? ticket.requesterId : changedBy,
          changedAt,
        },
      });
    }
    if (resolvedAt && (t.status === "RESOLVED" || t.status === "CLOSED")) {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { resolvedAt } });
    }
  }

  await prisma.publicComment.createMany({
    data: [
      {
        ticketId: ticketIdBySummary.get("Outlook freezing intermittently")!,
        authorId: userByEmail.get("it.staff@example.com")!,
        content: "We are investigating the issue on your device. We'll update you shortly.",
      },
      {
        ticketId: ticketIdBySummary.get("Outlook freezing intermittently")!,
        authorId: userByEmail.get("michael.brown@example.com")!,
        content: "Just adding that this issue occurs even when I close all applications.",
      },
      {
        ticketId: ticketIdBySummary.get("Cannot connect to VPN")!,
        authorId: userByEmail.get("sarah.johnson@example.com")!,
        content: "Still cannot connect after restarting my laptop this morning.",
      },
    ],
  });

  await prisma.internalNote.createMany({
    data: [
      {
        ticketId: ticketIdBySummary.get("Outlook freezing intermittently")!,
        authorId: userByEmail.get("it.staff@example.com")!,
        content: "Checked event logs, likely an Outlook add-in conflict introduced by this week's update. Escalating priority.",
      },
      {
        ticketId: ticketIdBySummary.get("Cannot connect to VPN")!,
        authorId: userByEmail.get("it.staff2@example.com")!,
        content: "VPN concentrator logs show repeated auth failures for this account. Resetting credentials and following up.",
      },
    ],
  });

  // Lab 4: requester flagged "appears resolved" (advisory, status unchanged, BR-19).
  await prisma.ticket.update({
    where: { id: ticketIdBySummary.get("Email not syncing on mobile")! },
    data: { requesterResolvedAt: new Date(seedNow - 3 * HOUR) },
  });

  // Lab 4: one real attachment, so the Attachment Notes on the VPN actions point to a file IT Staff can open.
  // A 1x1 PNG is written into uploads/ (the folder multer uses) each time the seed runs.
  mkdirSync("uploads", { recursive: true });
  const seedFile = path.join("uploads", "seed-vpn-error.png");
  writeFileSync(
    seedFile,
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"),
  );
  await prisma.attachment.create({
    data: {
      ticketId: ticketIdBySummary.get("Cannot connect to VPN")!,
      filename: "vpn-error.png",
      storedPath: seedFile,
      mimeType: "image/png",
      sizeBytes: 68,
    },
  });

  // Lab 4: Actions Taken. Tickets with 0, 1 and many actions; a performer who is not the owner (BR-02).
  const staff = userByEmail.get("it.staff@example.com")!;
  const staff2 = userByEmail.get("it.staff2@example.com")!;
  const staff3 = userByEmail.get("it.staff3@example.com")!;
  const ticketCreated = async (summary: string) =>
    (await prisma.ticket.findUniqueOrThrow({ where: { id: ticketIdBySummary.get(summary)! } })).createdAt.getTime();

  type SeedAction = {
    ticket: string; hoursAfterCreate: number; description: string; result?: string;
    status: "PLANNED" | "COMPLETED" | "CANCELLED"; performedBy: number; createdBy: number;
    followUpNote?: string; attachmentNotes?: string; key: string;
  };
  const actionSeeds: SeedAction[] = [
    { key: "seed-vpn-1", ticket: "Cannot connect to VPN", hoursAfterCreate: 5, status: "COMPLETED", performedBy: staff2, createdBy: staff2,
      description: "Reset VPN credentials and cleared cached certificates on the laptop.", result: "Login now reaches MFA step but times out." },
    { key: "seed-vpn-2", ticket: "Cannot connect to VPN", hoursAfterCreate: 7, status: "COMPLETED", performedBy: staff, createdBy: staff2,
      description: "Checked VPN concentrator logs from the network side.", result: "Found the account locked by repeated failures; unlocked it.",
      followUpNote: "Confirm with requester tomorrow that the connection stays up.", attachmentNotes: "See attachment vpn-error.png on this ticket." },
    { key: "seed-vpn-3", ticket: "Cannot connect to VPN", hoursAfterCreate: 30, status: "PLANNED", performedBy: staff2, createdBy: staff2,
      description: "Reinstall VPN client if the problem returns." },
    { key: "seed-dock-1", ticket: "Docking station not detected", hoursAfterCreate: 5, status: "COMPLETED", performedBy: staff, createdBy: staff,
      description: "Updated docking station firmware and USB-C drivers.", result: "Dock and both monitors detected after reboot." },
    { key: "seed-install-1", ticket: "Software installation request", hoursAfterCreate: 5, status: "COMPLETED", performedBy: staff2, createdBy: staff2,
      description: "Installed the requested software through the company portal.", result: "Installed and licence activated." },
    { key: "seed-onboard-1", ticket: "New employee setup request", hoursAfterCreate: 5, status: "COMPLETED", performedBy: staff3, createdBy: staff3,
      description: "Created accounts and prepared laptop for the new employee.", result: "Accounts active, laptop handed over." },
    { key: "seed-wifi-1", ticket: "Wi-Fi drops in meeting room", hoursAfterCreate: 5, status: "COMPLETED", performedBy: staff, createdBy: staff,
      description: "Moved the meeting room access point to a less crowded channel.", result: "Calls stable during a 30 minute test." },
    { key: "seed-wifi-2", ticket: "Wi-Fi drops in meeting room", hoursAfterCreate: 6, status: "CANCELLED", performedBy: staff3, createdBy: staff,
      description: "Replace the access point hardware.", },
    { key: "seed-outlook-1", ticket: "Outlook freezing intermittently", hoursAfterCreate: 3, status: "PLANNED", performedBy: staff, createdBy: staff,
      description: "Disable recently updated Outlook add-ins one by one." },
  ];
  for (const a of actionSeeds) {
    const actionAt = new Date((await ticketCreated(a.ticket)) + a.hoursAfterCreate * HOUR);
    await prisma.actionTaken.create({
      data: {
        ticketId: ticketIdBySummary.get(a.ticket)!,
        actionAt,
        description: a.description,
        result: a.result ?? null,
        status: a.status,
        performedById: a.performedBy,
        createdById: a.createdBy,
        followUpRequired: Boolean(a.followUpNote),
        followUpNote: a.followUpNote ?? null,
        attachmentNotes: a.attachmentNotes ?? null,
        clientRequestId: a.key,
        completedAt: a.status === "COMPLETED" ? actionAt : null,
        cancelledAt: a.status === "CANCELLED" ? actionAt : null,
      },
    });
  }
}
