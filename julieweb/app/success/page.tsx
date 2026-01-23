import Link from "next/link";
import styles from "../page.module.css";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateProfile } from "@/utils/profile";

type Props = {
    searchParams: {
        session_id?: string;
    };
};

export default async function Success({ searchParams }: Props) {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();

    let upgraded = false;

    if (user && searchParams.session_id && process.env.STRIPE_SECRET_KEY) {
        try {
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
            const session = await stripe.checkout.sessions.retrieve(searchParams.session_id);
            if (session.metadata?.user_id === user.id) {
                await getOrCreateProfile(supabase, user);
                await supabase.from("profiles").upsert(
                    {
                        id: user.id,
                        email: user.email,
                        is_premium: true
                    },
                    { onConflict: "id" }
                );
                upgraded = true;
            }
        } catch (error) {
            console.error("Unable to flag premium subscription", error);
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.backgroundImage} />
            <main className={styles.main}>
                <div className={styles.authContainer} style={{ maxWidth: "600px" }}>
                    <h2 className={styles.tagline} style={{ fontSize: "2rem", marginBottom: "1rem" }}>
                        {upgraded ? "Welcome to Pro!" : "Subscription confirmed"}
                    </h2>
                    <p className={styles.body} style={{ marginBottom: "2rem", fontSize: "1rem" }}>
                        {upgraded
                            ? "Your subscription is active and premium features are now available inside the desktop app."
                            : "We could not automatically refresh your status, but your payment succeeded. Please reopen settings to refresh."}
                    </p>
                    <Link href="/" className={styles.authButton}>
                        Return Home
                    </Link>
                </div>
            </main>
        </div>
    );
}
