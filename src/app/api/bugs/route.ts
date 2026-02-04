import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromRequest } from "../flow/_auth";
import { checkSimpleIpRateLimit } from "@lib/rate-limiting/simple-ip";
import { getMimeFromMagic } from "@lib/asset-upload-validation";

export const runtime = "nodejs";

type Category = "ui_visual" | "broken_flow" | "data_issue" | "performance" | "error_crash";
type FeatureArea =
  | "prompt_marketplace"
  | "prompt_studio"
  | "workflow_builder"
  | "purchases"
  | "account_auth"
  | "other";
type DeviceType = "desktop" | "mobile";
type BrowserType = "chrome" | "safari" | "firefox" | "edge" | "other";
type Severity = "blocking" | "major" | "minor";

const BUCKET = "bug_report_media"; // must match the bucket you create in SQL below
const MAX_FILES = 3;
const MAX_FILE_MB = 20;

function isOneOf<T extends string>(v: any, allowed: readonly T[]): v is T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v);
}

function sanitizeText(s: unknown, max = 4000) {
  const t = typeof s === "string" ? s : "";
  const cleaned = t.replace(/\r\n/g, "\n").trim();
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}

function asBool(v: unknown) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true";
  return false;
}

function safeFilename(name: string) {
  // keep it simple and storage-safe
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !service) {
    throw new Error("Server misconfigured: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, service, {
    auth: { persistSession: false },
  });
}

function computeTags(params: { severity: Severity; feature_area: FeatureArea; reporter_id?: string | null }) {
  const tags: string[] = [];

  if (params.severity === "blocking") tags.push("blocking");

  // heuristics: creator vs buyer
  if (params.feature_area === "prompt_studio" || params.feature_area === "workflow_builder") tags.push("creator");
  if (params.feature_area === "purchases") tags.push("buyer");

  return tags;
}

export async function POST(req: Request) {
  try {
    const { allowed } = checkSimpleIpRateLimit(req);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json({ error: "Invalid request: expected multipart/form-data" }, { status: 400 });
    }

    const form = await req.formData();

    const category = String(form.get("category") ?? "");
    const feature_area = String(form.get("feature_area") ?? "");
    const device_type = String(form.get("device_type") ?? "");
    const browser = String(form.get("browser") ?? "");
    const severity = String(form.get("severity") ?? "");

    const summary = sanitizeText(form.get("summary"), 180);
    const steps_to_reproduce = sanitizeText(form.get("steps_to_reproduce"), 4000);
    const expected_behavior = sanitizeText(form.get("expected_behavior"), 1000);
    const actual_behavior = sanitizeText(form.get("actual_behavior"), 1000);

    const allow_follow_up = asBool(form.get("allow_follow_up"));
    const reporter_contact = allow_follow_up ? sanitizeText(form.get("reporter_contact"), 120) : "";

    const current_url = sanitizeText(form.get("current_url"), 1000);
    const route_path = sanitizeText(form.get("route_path"), 300);
    const app_version = sanitizeText(form.get("app_version"), 120);
    const build_hash = sanitizeText(form.get("build_hash"), 120);
    const user_agent = sanitizeText(form.get("user_agent"), 1000);

    // strict enums (prevents junk in DB)
    const categoryAllowed = ["ui_visual", "broken_flow", "data_issue", "performance", "error_crash"] as const;
    const featureAllowed = [
      "prompt_marketplace",
      "prompt_studio",
      "workflow_builder",
      "purchases",
      "account_auth",
      "other",
    ] as const;
    const deviceAllowed = ["desktop", "mobile"] as const;
    const browserAllowed = ["chrome", "safari", "firefox", "edge", "other"] as const;
    const severityAllowed = ["blocking", "major", "minor"] as const;

    if (!isOneOf(category, categoryAllowed)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (!isOneOf(feature_area, featureAllowed)) {
      return NextResponse.json({ error: "Invalid feature_area" }, { status: 400 });
    }
    if (!isOneOf(device_type, deviceAllowed)) {
      return NextResponse.json({ error: "Invalid device_type" }, { status: 400 });
    }
    if (!isOneOf(browser, browserAllowed)) {
      return NextResponse.json({ error: "Invalid browser" }, { status: 400 });
    }
    if (!isOneOf(severity, severityAllowed)) {
      return NextResponse.json({ error: "Invalid severity" }, { status: 400 });
    }

    // required fields
    if (summary.length < 4) return NextResponse.json({ error: "Summary too short" }, { status: 400 });
    if (steps_to_reproduce.length < 10)
      return NextResponse.json({ error: "Steps to reproduce too short" }, { status: 400 });
    if (expected_behavior.length < 2) return NextResponse.json({ error: "Expected behavior required" }, { status: 400 });
    if (actual_behavior.length < 2) return NextResponse.json({ error: "Actual behavior required" }, { status: 400 });
    if (allow_follow_up && reporter_contact.length < 4)
      return NextResponse.json({ error: "Contact required for follow-up" }, { status: 400 });

    // files
    const incomingFiles = form.getAll("files").filter((v): v is File => v instanceof File);
    if (incomingFiles.length > MAX_FILES) {
      return NextResponse.json({ error: `Max ${MAX_FILES} attachments` }, { status: 400 });
    }
    for (const f of incomingFiles) {
      const okType = f.type.startsWith("image/") || f.type.startsWith("video/");
      if (!okType) return NextResponse.json({ error: "Attachments must be images/videos" }, { status: 400 });
      const mb = f.size / (1024 * 1024);
      if (mb > MAX_FILE_MB) return NextResponse.json({ error: `Max ${MAX_FILE_MB}MB per file` }, { status: 400 });
      if (f.type.startsWith("image/")) {
        const headerBlob = f.size >= 12 ? f.slice(0, 12) : f.slice(0, f.size);
        const buf = new Uint8Array(await headerBlob.arrayBuffer());
        const magicMime = getMimeFromMagic(buf);
        if (magicMime && magicMime !== f.type) {
          return NextResponse.json({ error: "Attachment content does not match declared image type" }, { status: 400 });
        }
        if (
          ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(f.type) &&
          !getMimeFromMagic(buf)
        ) {
          return NextResponse.json({ error: "Attachment content does not match declared image type" }, { status: 400 });
        }
      }
    }

    const supabase = getSupabaseAdmin();

    // Try to get authenticated user (optional - bugs can be anonymous)
    let reporter_id: string | null = null;
    try {
      const { user } = await getUserFromRequest(req);
      if (user) {
        reporter_id = user.id;
      }
    } catch {
      // Auth failed or no token - that's okay, keep reporter_id as null (anonymous bug report)
    }

    // tags
    const tags = computeTags({
      severity: severity as Severity,
      feature_area: feature_area as FeatureArea,
      reporter_id,
    });

    // repeat_reporter heuristic (by contact, if provided)
    if (reporter_contact) {
      const { count } = await supabase
        .from("bug_reports")
        .select("id", { count: "exact", head: true })
        .eq("reporter_contact", reporter_contact);

      if ((count ?? 0) >= 2) tags.push("repeat_reporter");
    }

    // 1) insert bug report
    const { data: report, error: insErr } = await supabase
      .from("bug_reports")
      .insert({
        reporter_id,
        reporter_contact: reporter_contact || null,
        allow_follow_up,
        category,
        summary,
        steps_to_reproduce,
        expected_behavior,
        actual_behavior,
        feature_area,
        device_type,
        browser,
        severity,
        current_url,
        route_path,
        app_version: app_version || null,
        build_hash: build_hash || null,
        user_agent: user_agent || null,
        tags,
      })
      .select("id, created_at")
      .single();

    if (insErr || !report?.id) {
      return NextResponse.json({ error: insErr?.message || "Failed to insert bug report" }, { status: 500 });
    }

    // 2) upload attachments (if any) + insert attachment rows
    if (incomingFiles.length > 0) {
      const createdAt = report.created_at ? new Date(report.created_at).getTime() : Date.now();
      const datePrefix = new Date(createdAt).toISOString().slice(0, 10); // yyyy-mm-dd

      for (const f of incomingFiles) {
        const ext = (() => {
          const parts = f.name.split(".");
          return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
        })();

        const safe = safeFilename(f.name || "upload");
        const rand = crypto.randomUUID();
        const path = `bug_reports/${datePrefix}/${report.id}/${rand}${ext ? `.${ext}` : ""}-${safe}`;

        const arr = new Uint8Array(await f.arrayBuffer());

        const up = await supabase.storage.from(BUCKET).upload(path, arr, {
          contentType: f.type || "application/octet-stream",
          upsert: false,
        });

        if (up.error) {
          // If storage fails, still keep the bug report. Return 200 with a warning-style message.
          return NextResponse.json(
            {
              id: report.id,
              warning: `Bug saved, but attachment upload failed: ${up.error.message}`,
            },
            { status: 200 }
          );
        }

        const { error: attErr } = await supabase.from("bug_report_attachments").insert({
          bug_report_id: report.id,
          storage_bucket: BUCKET,
          storage_path: path,
          mime_type: f.type || null,
          file_size_bytes: f.size,
          original_file_name: f.name || null,
        });

        if (attErr) {
          return NextResponse.json(
            { id: report.id, warning: `Bug saved, but attachment record failed: ${attErr.message}` },
            { status: 200 }
          );
        }
      }
    }

    return NextResponse.json({ id: report.id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
