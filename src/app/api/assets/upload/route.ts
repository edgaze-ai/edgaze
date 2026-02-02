// src/app/api/assets/upload/route.ts
import { NextResponse } from "next/server";
import { getUserAndClient } from "../../flow/_auth";

const BUCKET = "edgaze-assets";

export async function POST(req: Request) {
  try {
    const { user, supabase } = await getUserAndClient(req);
    if (!user || !supabase) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = user.id;

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileExt = file.name.includes(".") ? file.name.split(".").pop() : "";
    const fileName = `${crypto.randomUUID()}${fileExt ? `.${fileExt}` : ""}`;
    const filePath = `${userId}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, fileBytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    const publicUrl = publicData.publicUrl;

    const { data: inserted, error: insertError } = await supabase
      .from("assets")
      .insert({
        user_id: userId,
        bucket: BUCKET,
        path: filePath,
        mime_type: file.type,
        size_bytes: file.size,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert asset error:", insertError);
      // still return the uploaded public url so user isn't blocked
    }

    return NextResponse.json({
      id: inserted?.id ?? filePath,
      publicUrl,
      path: filePath,
      sizeBytes: file.size,
      createdAt: inserted?.created_at ?? new Date().toISOString(),
    });
  } catch (err) {
    console.error("Unexpected upload error:", err);
    return NextResponse.json({ error: "Unexpected error while uploading asset" }, { status: 500 });
  }
}
