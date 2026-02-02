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
import { getUserAndClient } from "../../flow/_auth";

export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await getUserAndClient(req);
    if (!user || !supabase) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

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
      if (checkError.message.includes("does not exist") || checkError.message.includes("relation")) {
        console.error(`Table ${likesTable} does not exist. Run the database migration for like tracking.`);
        return NextResponse.json(
          {
            error: "Like tracking is not configured. Please run the database migration.",
            details: `Table ${likesTable} does not exist.`,
          },
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
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
    const { user, supabase } = await getUserAndClient(req);

    if (!user || !supabase) {
      return NextResponse.json({ isLiked: false }, { status: 200 });
    }

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
