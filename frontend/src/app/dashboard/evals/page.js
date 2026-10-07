import { connection } from "next/server";
import { loadRuns } from "@/lib/evals";
import { EvalsView } from "../../components/evals/EvalsView";

export const metadata = {
  title: "Evals — NEXUS.ai",
  description: "Eval harness runs: pass rates, flaky cases and regressions.",
};

/**
 * Renders at request time: the harness rewrites evals/results/*.json under it.
 * Entirely server-rendered — hover labels are CSS and choosing a run is a link.
 */
export default async function EvalsPage({ searchParams }) {
  await connection();
  const [{ run }, data] = await Promise.all([searchParams, loadRuns()]);
  return <EvalsView wanted={run} base="/dashboard/evals" data={data} />;
}
