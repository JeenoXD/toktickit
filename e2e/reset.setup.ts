import { test as setup } from "@playwright/test";
import { execSync } from "node:child_process";

setup("reseed database", async () => {
  execSync("npm run prisma:seed", { cwd: "../server", stdio: "inherit" });
});