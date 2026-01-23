// src/app/api/marketplace/like/route.ts
// 
// This API route handles toggling likes for marketplace items (prompts/workflows).
// 
// REQUIRED DATABASE TABLES:
// - prompt_likes: (user_id UUID, item_id UUID, created_at TIMESTAMP)
// - workflow_likes: (user_id UUID, item_id UUID, created_at TIMESTAMP)
// 
// Both tables should have:
// - Primary key on (user_id, item_id)
// - Foreign key constraints to users and items
// - RLS policies allowing authenticated users to insert/delete their own likes
//
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // ignore (headers may already be sent)
          }
        },
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServer();

    // Get user - same pattern as other API routes
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = auth.user;

    const body = await req.json().catch(() => null);
    if (!body || typeof body.itemId !== "string" || typeof body.itemType !== "string") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { itemId, itemType } = body;
    
    if (itemType !== "prompt" && itemType !== "workflow") {
      return NextResponse.json({ error: "Invalid item type" }, { status: 400 });
    }

    // Determine which table to use for likes tracking
    const likesTable = itemType === "workflow" ? "workflow_likes" : "prompt_likes";
    const itemsTable = itemType === "workflow" ? "workflows" : "prompts";
    const likesCountColumn = "likes_count";
    const itemIdColumn = itemType === "workflow" ? "workflow_id" : "prompt_id";
    
    // Convert UUID to text for user_id (schema uses text, not uuid)
    const userIdStr = String(user.id);

    // Check if user has already liked this item
    const { data: existingLike, error: checkError } = await supabase
      .from(likesTable)
      .select("id")
      .eq("user_id", userIdStr)
      .eq(itemIdColumn, itemId)
      .maybeSingle();

    if (checkError) {
      // If table doesn't exist, fall back to old behavior (just update count)
      if (checkError.message.includes("does not exist") || checkError.message.includes("relation")) {
        console.warn(`Table ${likesTable} does not exist. Falling back to count-only update.`);
        
        // Fallback: just increment the count (old behavior, but prevents errors)
        // Note: This doesn't prevent unlimited likes, but at least the UI won't break
        const { data: item } = await supabase
          .from(itemsTable)
          .select(likesCountColumn)
          .eq("id", itemId)
          .single();

        const currentCount = (item as any)?.[likesCountColumn] ?? 0;
        const newCount = currentCount + 1; // Always increment in fallback mode
        
        const { error: updateError } = await supabase
          .from(itemsTable)
          .update({ [likesCountColumn]: newCount })
          .eq("id", itemId);

        if (updateError) {
        return NextResponse.json(
          { error: "Failed to update like count", details: updateError.message },
          { 
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
        }

        return NextResponse.json(
          {
            success: true,
            likesCount: newCount,
            isLiked: true,
            warning: `Table ${likesTable} does not exist. Please run the database migration for proper like tracking.`,
          },
          { 
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      console.error("Error checking existing like:", checkError);
      return NextResponse.json(
        { error: "Failed to check like status", details: checkError.message },
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    let newLikesCount: number;
    let isLiked: boolean;

    if (existingLike) {
      // User has already liked - remove the like
      const { error: deleteError } = await supabase
        .from(likesTable)
        .delete()
        .eq("user_id", userIdStr)
        .eq(itemIdColumn, itemId);

      if (deleteError) {
        console.error("Error deleting like:", deleteError);
        // Return error instead of falling back
        return NextResponse.json(
          { error: "Failed to remove like", details: deleteError.message },
          { 
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      } else {
        // Successfully deleted like - decrement count
        const { data: item } = await supabase
          .from(itemsTable)
          .select(likesCountColumn)
          .eq("id", itemId)
          .single();

        const currentCount = (item as any)?.[likesCountColumn] ?? 0;
        newLikesCount = Math.max(0, currentCount - 1);
        isLiked = false;

        await supabase
          .from(itemsTable)
          .update({ [likesCountColumn]: newLikesCount })
          .eq("id", itemId);
      }
    } else {
      // User hasn't liked - add the like directly (RLS will enforce security)
      const insertData = itemType === "workflow" 
        ? { user_id: userIdStr, workflow_id: itemId }
        : { user_id: userIdStr, prompt_id: itemId };
        
      const { error: insertError } = await supabase
        .from(likesTable)
        .insert(insertData);
        
      if (insertError) {
        // Check if it's a duplicate (user already liked)
        if (insertError.message.includes("unique") || insertError.message.includes("duplicate") || insertError.message.includes("already")) {
          // User already liked - get current count
          const { data: item } = await supabase
            .from(itemsTable)
            .select(likesCountColumn)
            .eq("id", itemId)
            .single();

          newLikesCount = (item as any)?.[likesCountColumn] ?? 0;
          isLiked = true;
          
          return NextResponse.json(
            {
              success: true,
              likesCount: newLikesCount,
              isLiked,
            },
            { status: 200 }
          );
        }
        
        // Other error
        console.error("Error inserting like:", insertError);
        return NextResponse.json(
          { error: "Failed to add like", details: insertError.message },
          { status: 500 }
        );
      }
      
      // Successfully inserted like - increment count
      const { data: item } = await supabase
        .from(itemsTable)
        .select(likesCountColumn)
        .eq("id", itemId)
        .single();

      const currentCount = (item as any)?.[likesCountColumn] ?? 0;
      newLikesCount = currentCount + 1;
      isLiked = true;

      await supabase
        .from(itemsTable)
        .update({ [likesCountColumn]: newLikesCount })
        .eq("id", itemId);
    }

    return NextResponse.json(
      {
        success: true,
        likesCount: newLikesCount,
        isLiked,
      },
      { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (err) {
    console.error("Unexpected like error", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: errorMessage 
      },
      { 
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
}

// GET endpoint to check if user has liked an item
export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    
    // Get user - same pattern as other API routes
    const { data: auth } = await supabase.auth.getUser();
    
    if (!auth?.user) {
      return NextResponse.json({ isLiked: false }, { status: 200 });
    }

    const user = auth.user;

    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");
    const itemType = searchParams.get("itemType");

    if (!itemId || !itemType || (itemType !== "prompt" && itemType !== "workflow")) {
      return NextResponse.json({ isLiked: false }, { status: 200 });
    }

    const likesTable = itemType === "workflow" ? "workflow_likes" : "prompt_likes";
    const itemIdColumn = itemType === "workflow" ? "workflow_id" : "prompt_id";
    
    // Convert UUID to text for user_id (schema uses text, not uuid)
    const userIdStr = String(user.id);

    const { data: existingLike, error } = await supabase
      .from(likesTable)
      .select("id")
      .eq("user_id", userIdStr)
      .eq(itemIdColumn, itemId)
      .maybeSingle();

    if (error && !error.message.includes("does not exist")) {
      console.error("Error checking like status:", error);
    }

    return NextResponse.json(
      { isLiked: !!existingLike },
      { status: 200 }
    );
  } catch (err) {
    console.error("Unexpected error checking like", err);
    return NextResponse.json({ isLiked: false }, { status: 200 });
  }
}
