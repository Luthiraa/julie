import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "../../page.module.css";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateProfile, mapProfileResponse } from "@/utils/profile";
import { LinkClient } from "./LinkClient";

type Props = {
    searchParams: Promise<{
        code?: string;
        force?: string;
    }>;
};

export default async function DesktopLinkPage(props: Props) {
    const searchParams = await props.searchParams;
    const code = typeof searchParams.code === "string" ? searchParams.code : null;
    const forceLogin = searchParams.force === "1";
    const qs = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
        if (key === "force") return;
        if (Array.isArray(value)) {
            value.forEach((v) => qs.append(key, v));
        } else if (value !== undefined) {
            qs.set(key, value);
        }
    });
    const pathWithoutForce = qs.toString() ? `/desktop/link?${qs.toString()}` : "/desktop/link";
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();

    if (forceLogin && user) {
        redirect(pathWithoutForce);
    }

    if (!user) {
        // If we have a code, keep it. If not, just redirect to self.
        const nextPath = qs.toString() ? `/desktop/link?${qs.toString()}` : "/desktop/link";
        return (
            <div className={styles.page}>
                <div className={styles.backgroundImage} />
                <main className={styles.main}>
                    <div className={styles.logo}>
                        <Link href="/">
                            <span className={styles.tagline}>Julie</span>
                        </Link>
                    </div>
                    <div className={styles.authContainer} style={{ maxWidth: "420px" }}>
                        <p className={styles.tagline} style={{ fontSize: "1.75rem" }}>
                            Sign in to continue
                        </p>
                        <p className={styles.body} style={{ marginBottom: "1.5rem" }}>
                            Sign in to link your account to the Julie desktop app.
                        </p>
                        <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className={styles.authButton}>
                            Log in
                        </Link>
                        <Link
                            href={`/signup?next=${encodeURIComponent(nextPath)}`}
                            className={styles.authLink}
                            style={{ marginTop: "1rem" }}
                        >
                            Need an account? Sign up
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    const profileRow = await getOrCreateProfile(supabase, user);
    const profile = mapProfileResponse(profileRow);

    return (
        <LinkClient
            code={code}
            user={{ id: user.id, email: user.email ?? null }}
            profile={profile}
        />
    );
}
