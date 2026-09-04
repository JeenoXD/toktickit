import { getPrisma } from "../src/prisma.js";

// Issue 3 — seed the four supported categories.
// The four names are: Account and Access, Hardware, Software, Network.
// Requirement: running the seed twice must NOT create duplicates.
// Hint: prisma.category.upsert({ where:{name}, update:{}, create:{name} }).
async function main() {
  const prisma = getPrisma();
  const names = ["Account and Access", "Hardware", "Software", "Network"];

  for (const name of names) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  const requesters = [
    { name: "Jennifer Anderson", email: "jennifer.anderson@example.com", isActive: true },
    { name: "Michael Brown", email: "michael.brown@example.com", isActive: true },
    { name: "Sarah Johnson", email: "sarah.johnson@example.com", isActive: true },
    { name: "David Lee", email: "david.lee@example.com", isActive: true },
    { name: "Inactive Test User", email: "inactive.user@example.com", isActive: false },
  ];

  for (const r of requesters) {
    await prisma.requesterUser.upsert({
      where: { email: r.email },
      update: {},
      create: r,
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
