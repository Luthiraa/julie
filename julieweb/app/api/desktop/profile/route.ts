import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateProfile, mapProfileResponse } from "@/utils/profile";

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
        error
    } = await supabase.auth.getUser();

    if (error || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileRow = await getOrCreateProfile(supabase, user);

    return NextResponse.json({
        user: {
            id: user.id,
            email: user.email
        },
        profile: mapProfileResponse(profileRow)
    });
}

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { customPrompt } = await request.json();
    if (typeof customPrompt !== "string") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const profileRow = await getOrCreateProfile(supabase, user);

    if (!profileRow.is_premium) {
        return NextResponse.json({ error: "Premium required" }, { status: 403 });
    }

    const { data, error } = await supabase
        .from("profiles")
        .update({
            custom_prompt: customPrompt,
            email: user.email
        })
        .eq("id", user.id)
        .select("id,email,is_premium,custom_prompt")
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        user: {
            id: user.id,
            email: user.email
        },
        profile: mapProfileResponse(data)
    });
}
