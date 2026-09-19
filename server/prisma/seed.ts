import { getPrisma } from "../src/prisma.js";
import { resetAndSeed } from "./seedData.js";

resetAndSeed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });