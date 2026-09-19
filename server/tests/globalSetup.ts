import { execSync } from "node:child_process";

export default async function globalSetup() {
  execSync("npm run prisma:seed", { stdio: "inherit" });
}