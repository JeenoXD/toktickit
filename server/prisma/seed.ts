import bcrypt from "bcrypt";
import { getPrisma } from "../src/prisma.js";

async function main() {
  const prisma = getPrisma();

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "InternalNote", "PublicComment", "Attachment", "Ticket", "User", "RelatedSystem", "Category" RESTART IDENTITY CASCADE;`);

  const names = ["Account and Access", "Hardware", "Software", "Network"];
  const relatedSystems = ["Email", "Campus Wi-Fi", "VPN", "LEB2 App", "Grade Submission App", "Printer", "Corporate Laptop"];

  const defaultPasswordHash = await bcrypt.hash("TempPass123!", 10);

  const users = [
    { name: "Jennifer Anderson", email: "jennifer.anderson@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "Michael Brown", email: "michael.brown@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "Sarah Johnson", email: "sarah.johnson@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "David Lee", email: "david.lee@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "Inactive Test User", email: "inactive.user@example.com", role: "REQUESTER" as const, isActive: false },
    { name: "IT Support Staff", email: "it.staff@example.com", role: "IT_STAFF" as const, isActive: true },
    { name: "System Admin", email: "admin@example.com", role: "ADMINISTRATOR" as const, isActive: true },
  ];

  for (const name of names) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  for (const u of users) {
    await prisma.user.upsert({
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
  }

  for (const name of relatedSystems) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: {},
      create: { name, isActive: true },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });