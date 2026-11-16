#!/usr/bin/env node
import { main } from "./audit-report.mjs";

try {
  process.exitCode = main();
} catch (error) {
  console.error(`Audit input invalid: ${error.message}`);
  process.exitCode = 1;
}
