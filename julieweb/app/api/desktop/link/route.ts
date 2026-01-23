import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getOrCreateProfile, mapProfileResponse, ProfileResponse } from "@/utils/profile";

type LinkPayload = {
    user: {
        id: string;
        email: string | null;
    };
    profile: ProfileResponse;
    apiKey?: string;
};

export async function POST(request: Request) {
    console.log("[POST] /api/desktop/link - Started");
    const { code, apiKey, customPrompt } = await request.json();
    if (!code || typeof code !== "string") {
        console.error("[POST] Missing code");
        return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
        data: { user },
        error
    } = await supabase.auth.getUser();

    if (error || !user) {
        console.error("[POST] Unauthorized:", error);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[POST] Authenticated user:", user.id);

    let profileRow = await getOrCreateProfile(supabase, user);
    let profile = mapProfileResponse(profileRow);

    if (profile.isPremium && typeof customPrompt === "string") {
        const { data: updated, error: updateError } = await supabase
            .from("profiles")
            .update({ custom_prompt: customPrompt })
            .eq("id", user.id)
            .select("id,email,is_premium,custom_prompt")
            .single();
        if (updateError) {
            console.error("[POST] Profile update error:", updateError);
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
        profileRow = updated;
        profile = mapProfileResponse(profileRow);
    }

    if (!profile.isPremium && (!apiKey || typeof apiKey !== "string" || !apiKey.startsWith("gsk_"))) {
        console.error("[POST] Missing/Invalid API Key");
        return NextResponse.json({ error: "API key required" }, { status: 400 });
    }

    const payload: LinkPayload = {
        user: { id: user.id, email: user.email ?? null },
        profile
    };

    if (!profile.isPremium) {
        payload.apiKey = apiKey;
    }

    // Use authenticated client to write to the table
    // Using insert() instead of upsert() because we only have INSERT permission via RLS
    console.log("[POST] Inserting desktop_link for code:", code);

    const { error: insertError } = await supabase
        .from("desktop_links")
        .insert({
            code,
            user_id: user.id,
            payload,
            created_at: new Date().toISOString()
        });

    if (insertError) {
        console.error("[POST] DB Insert Error:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    console.log("[POST] Success");
    return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    console.log("[GET] /api/desktop/link - Checking code:", code);

    if (!code) {
        return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    // Use RPC to safely get and consume the link without Service Role Key
    // This relies on the function `get_and_consume_link` being defined in Supabase
    const supabase = await createClient(); // Use standard client (anonymous)

    const { data: payload, error } = await supabase
        .rpc('get_and_consume_link', { link_code: code });

    if (error) {
        console.error("[GET] RPC Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!payload) {
        return NextResponse.json({ status: "pending" });
    }

    console.log("[GET] Linked! Payload found via RPC.");
    return NextResponse.json({ status: "linked", payload });
}
