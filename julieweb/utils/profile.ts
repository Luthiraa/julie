import { SupabaseClient, User } from "@supabase/supabase-js";

type ProfileRow = {
    id: string;
    email: string | null;
    is_premium: boolean | null;
    custom_prompt: string | null;
};

export async function getOrCreateProfile(
    supabase: SupabaseClient,
    user: User
): Promise<ProfileRow> {
    const { data, error } = await supabase
        .from("profiles")
        .select("id,email,is_premium,custom_prompt")
        .eq("id", user.id)
        .maybeSingle();

    if (error && error.code !== "PGRST116") {
        throw error;
    }

    if (data) {
        return data;
    }

    const { data: inserted, error: insertError } = await supabase
        .from("profiles")
        .upsert(
            {
                id: user.id,
                email: user.email,
                is_premium: false,
                custom_prompt: null
            },
            { onConflict: "id" }
        )
        .select("id,email,is_premium,custom_prompt")
        .single();

    if (insertError) {
        throw insertError;
    }

    return inserted;
}

export type ProfileResponse = {
    isPremium: boolean;
    customPrompt: string;
};

export function mapProfileResponse(row: ProfileRow | null): ProfileResponse {
    return {
        isPremium: Boolean(row?.is_premium),
        customPrompt: row?.custom_prompt ?? ""
    };
}
