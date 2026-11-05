/* Measures the effect of indexes with MongoDB's explain("executionStats").
 * Usage:  npm run seed && SEED_COMPLAINTS=50000 npm run seed -- --reset   (bigger data = clearer difference)
 *         npm run explain
 *
 * It compares the same query run (a) with the index and (b) forced to scan the whole collection.
 * Paste the printed table into docs/PERFORMANCE_REPORT.md together with the dataset size and your machine. */
import { connectDB, disconnectDB } from "../config/db";
import { Complaint } from "../models/Complaint";
import { Organization } from "../models/Organization";

interface Stats {
  executionTimeMillis: number;
  totalDocsExamined: number;
  totalKeysExamined: number;
  nReturned: number;
}

async function extractStats(q: any, hint?: Record<string, 1 | -1>): Promise<Stats> {
  if (hint) q = q.hint(hint);
  const raw = await q.explain("executionStats");
  const stats = raw.executionStats ?? raw;
  return {
    executionTimeMillis: stats.executionTimeMillis ?? 0,
    totalDocsExamined: stats.totalDocsExamined ?? 0,
    totalKeysExamined: stats.totalKeysExamined ?? 0,
    nReturned: stats.nReturned ?? 0,
  };
}

async function main() {
  await connectDB();
  const org = await Organization.findOne({ slug: { $in: ["resolvex-demo", "demo-org"] } });
  if (!org) throw new Error('Run "npm run seed" or initialize demo first.');
  const organizationId = org._id;
  const total = await Complaint.countDocuments({ organizationId });

  const cases: { name: string; run: (hint?: Record<string, 1 | -1>) => Promise<Stats> }[] = [
    {
      name: "Admin list: status=IN_PROGRESS, newest first, page 1",
      run: (hint) => extractStats(Complaint.find({ organizationId, status: "IN_PROGRESS" }).sort({ createdAt: -1 }).limit(20), hint),
    },
    {
      name: "Employee list: assignedTo=<employee>, status=ASSIGNED",
      run: async (hint) => {
        const sample = await Complaint.findOne({ organizationId, assignedTo: { $ne: null } }).select("assignedTo").lean();
        return extractStats(Complaint.find({ organizationId, assignedTo: sample?.assignedTo, status: "ASSIGNED" }).limit(20), hint);
      },
    },
    {
      name: "Customer list: customerId=<customer>, newest first",
      run: async (hint) => {
        const sample = await Complaint.findOne({ organizationId }).select("customerId").lean();
        return extractStats(Complaint.find({ organizationId, customerId: sample?.customerId }).sort({ createdAt: -1 }).limit(20), hint);
      },
    },
  ];

  console.log(`\nDataset: ${total} complaints in demo-org (seeded demo data)\n`);
  console.log("| Query | Mode | Docs examined | Keys examined | Returned | Time (ms) |");
  console.log("|---|---|---|---|---|---|");
  for (const c of cases) {
    const indexed = await c.run();
    const scan = await c.run({ $natural: 1 });
    const row = (mode: string, s: Stats) =>
      `| ${c.name} | ${mode} | ${s.totalDocsExamined} | ${s.totalKeysExamined} | ${s.nReturned} | ${s.executionTimeMillis} |`;
    console.log(row("With index", indexed));
    console.log(row("Full collection scan", scan));
  }
  console.log("\nCopy this table into docs/PERFORMANCE_REPORT.md with your machine details.");
  await disconnectDB();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDB().catch(() => undefined);
  process.exit(1);
});
