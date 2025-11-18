import { NextResponse } from "next/server";

/**
 * Simple mock runner so the Frontend “Run” flow never 404s.
 * Replace the simulated work with your real executor later.
 */
export async function POST() {
  // Simulate a quick run so the modal shows useful data
  const start = new Date().toLocaleTimeString();

  // pretend-work delay
  await new Promise((r) => setTimeout(r, 500));

  const blocks = [
    { id: "input-a1", label: "Input", status: "done" },
    { id: "merge-b2", label: "Merge", status: "done" },
    { id: "output-c3", label: "Output", status: "done" },
  ];

  const log = [
    { ts: start, text: "Starting the workflow…", level: "info" as const },
    { ts: new Date().toLocaleTimeString(), text: "Reading inputs", level: "info" as const },
    { ts: new Date().toLocaleTimeString(), text: "Merging data", level: "info" as const },
    { ts: new Date().toLocaleTimeString(), text: "Producing output", level: "info" as const },
    { ts: new Date().toLocaleTimeString(), text: "Finished successfully", level: "info" as const },
  ];

  return NextResponse.json({ ok: true, blocks, log }, { status: 200 });
}
