import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { SITE_URL } from "@/utils/site-url";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function GET(request: Request) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (!user) {
        return redirect("/login");
    }

    const session = await stripe.checkout.sessions.create({
        customer_email: user.email,
        line_items: [
            {
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: "Julie Pro Subscription",
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
        success_url: `${SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SITE_URL}/pricing`,
        metadata: {
            user_id: user.id,
        },
    });

    if (session.url) {
        return redirect(session.url);
    }

    return redirect("/error");
}
