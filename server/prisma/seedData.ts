import bcrypt from "bcrypt";
import { getPrisma } from "../src/prisma.js";
import { generateTicketNumber } from "../src/ticketNumber.js";

export async function resetAndSeed(): Promise<void> {
  const prisma = getPrisma();

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "InternalNote", "PublicComment", "Attachment", "Ticket", "User", "RelatedSystem", "Category" RESTART IDENTITY CASCADE;`);

  const categoryNames = ["Account and Access", "Hardware", "Software", "Network"];
  const relatedSystemNames = ["Email", "Campus Wi-Fi", "VPN", "LEB2 App", "Grade Submission App", "Printer", "Corporate Laptop"];

  const defaultPasswordHash = await bcrypt.hash("TempPass123!", 10);

  const users = [
    { name: "Jennifer Anderson", email: "jennifer.anderson@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "Michael Brown", email: "michael.brown@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "Sarah Johnson", email: "sarah.johnson@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "David Lee", email: "david.lee@example.com", role: "REQUESTER" as const, isActive: true },
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
  ];

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
      },
    });
    ticketIdBySummary.set(t.summary, ticket.id);
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
}