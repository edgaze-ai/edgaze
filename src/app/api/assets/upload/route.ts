// src/app/api/assets/upload/route.ts
import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

const BUCKET = "edgaze-assets";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const userId = formData.get("userId");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (typeof userId !== "string" || !userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, fileBytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    const { data: publicData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath);

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

    return NextResponse.json({
      id: inserted?.id ?? filePath,
      publicUrl,
      path: filePath,
      sizeBytes: file.size,
      createdAt: inserted?.created_at ?? new Date().toISOString(),
    });
  } catch (err) {
    console.error("Unexpected upload error:", err);
    return NextResponse.json(
      { error: "Unexpected error while uploading asset" },
      { status: 500 }
    );
  }
}
