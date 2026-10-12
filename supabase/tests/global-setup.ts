import { execFileSync } from "node:child_process";
import path from "node:path";

// Spielt vor jedem Testlauf Schema, Funktionen und Seed frisch ein.
export default function setup() {
  if (process.env["AXION_SKIP_DB_RESET"] === "1") return;
  const script = path.resolve(__dirname, "../../scripts/db/local-db.sh");
  execFileSync(script, ["reset"], { stdio: "inherit" });
}
