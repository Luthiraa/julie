import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { SITE_URL } from "@/utils/site-url";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/";

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            return NextResponse.redirect(`${SITE_URL}/auth/auth-code-error`);
        }

        // If next is /api/checkout, create Stripe session here instead of redirecting
        if (next === "/api/checkout") {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                return NextResponse.redirect(`${SITE_URL}/login`);
            }

            const Stripe = (await import("stripe")).default;
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

            const forwardedHost = request.headers.get("x-forwarded-host");
            const isLocalEnv = process.env.NODE_ENV === "development";
            const baseUrl = forwardedHost && !isLocalEnv ? `https://${forwardedHost}` : SITE_URL;

            const session = await stripe.checkout.sessions.create({
                customer_email: user.email,
                line_items: [
                    {
                        price_data: {
                            currency: "usd",
                            product_data: {
                                name: "Julie Zero",
                                description: "Get the most out of Julie out of the box, with access to the latest models and features. Zero setup required.",
                            },
                            unit_amount: 999,
                            recurring: {
                                interval: "month",
                            },
                        },
                        quantity: 1,
                    },
                ],
                mode: "subscription",
                success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${baseUrl}/pricing`,
                metadata: {
                    user_id: user.id,
                },
            });

            if (session.url) {
                return NextResponse.redirect(session.url);
            }

            return NextResponse.redirect(`${SITE_URL}/error`);
        }

        const forwardedHost = request.headers.get("x-forwarded-host");
        const isLocalEnv = process.env.NODE_ENV === "development";

        const baseUrl = forwardedHost && !isLocalEnv ? `https://${forwardedHost}` : SITE_URL;
        let redirectUrl = `${baseUrl}${next}`;

        const response = NextResponse.redirect(redirectUrl);

        // Manually copy cookies from the store to the response to ensure they are sent
        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll();

        allCookies.forEach(cookie => {
            const { name, value, ...options } = cookie;
            response.cookies.set({
                name,
                value,
                ...options,
            });
        });

        return response;
    }

    return NextResponse.redirect(`${SITE_URL}/auth/auth-code-error`);
}
