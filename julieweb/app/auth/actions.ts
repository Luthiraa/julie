"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { SITE_URL } from "@/utils/site-url";

export async function signInWithGoogle(formData?: FormData) {
    const supabase = await createClient();
    const next = (formData?.get("next") as string) || "/api/checkout";

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
        },
    });

    if (error) {
        redirect("/error");
    }

    if (data.url) {
        redirect(data.url);
    }
}

export async function login(formData: FormData) {
    const supabase = await createClient();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const next = (formData.get("next") as string) || "/api/checkout";

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return redirect(`/login?message=Could not authenticate user&next=${encodeURIComponent(next)}`);
    }

    return redirect(next);
}

export async function signup(formData: FormData) {
    const supabase = await createClient();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const next = (formData.get("next") as string) || "/api/checkout";

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
        },
    });

    if (error) {
        return redirect(`/signup?message=Could not authenticate user&next=${encodeURIComponent(next)}`);
    }

    return redirect("/signup?message=Check email to continue sign in process");
}
