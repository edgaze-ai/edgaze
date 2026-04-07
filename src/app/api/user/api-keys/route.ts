import { NextResponse } from "next/server";
import { getUserFromRequest } from "@lib/auth/server";
import { resolveActorContext } from "@lib/auth/actor-context";
import { assertNotImpersonating, ImpersonationForbiddenError } from "@lib/auth/sensitive-action";
import {
  deleteUserApiKeySecret,
  listUserApiKeyMetadata,
  parseUserApiKeyProvider,
  upsertUserApiKeySecret,
} from "@lib/user-api-keys/vault";

export async function GET(req: Request) {
  const { user, error } = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const actor = await resolveActorContext(req, user);
    assertNotImpersonating(actor.actorMode);
  } catch (e) {
    if (e instanceof ImpersonationForbiddenError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 403 });
    }
    throw e;
  }

  const keys = await listUserApiKeyMetadata(user.id);
  return NextResponse.json({ ok: true, keys });
}

export async function POST(req: Request) {
  const { user, error } = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const actor = await resolveActorContext(req, user);
    assertNotImpersonating(actor.actorMode);
  } catch (e) {
    if (e instanceof ImpersonationForbiddenError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 403 });
    }
    throw e;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const rec = body as { provider?: string; secret?: string };
  const provider = parseUserApiKeyProvider(rec.provider ?? "");
  if (!provider) {
    return NextResponse.json({ ok: false, error: "Invalid provider" }, { status: 400 });
  }
  if (typeof rec.secret !== "string") {
    return NextResponse.json({ ok: false, error: "secret is required" }, { status: 400 });
  }

  const result = await upsertUserApiKeySecret(user.id, provider, rec.secret);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  const keys = await listUserApiKeyMetadata(user.id);
  return NextResponse.json({ ok: true, keys });
}

export async function DELETE(req: Request) {
  const { user, error } = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const actor = await resolveActorContext(req, user);
    assertNotImpersonating(actor.actorMode);
  } catch (e) {
    if (e instanceof ImpersonationForbiddenError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 403 });
    }
    throw e;
  }

  const url = new URL(req.url);
  const provider = parseUserApiKeyProvider(url.searchParams.get("provider") ?? "");
  if (!provider) {
    return NextResponse.json({ ok: false, error: "Invalid provider" }, { status: 400 });
  }

  const result = await deleteUserApiKeySecret(user.id, provider);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  const keys = await listUserApiKeyMetadata(user.id);
  return NextResponse.json({ ok: true, keys });
}
