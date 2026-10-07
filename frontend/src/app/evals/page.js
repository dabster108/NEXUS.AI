import { redirect } from "next/navigation";

/** The evals view now lives inside the dashboard shell. Old links keep working. */
export default async function EvalsRedirect({ searchParams }) {
  const { run } = await searchParams;
  redirect(`/dashboard/evals${run ? `?run=${encodeURIComponent(run)}` : ""}`);
}
