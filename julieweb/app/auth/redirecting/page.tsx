"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../../page.module.css";

function RedirectingContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const next = searchParams.get("next") || "/";

    useEffect(() => {
        // Longer timeout to ensure cookies are fully processed
        const timer = setTimeout(() => {
            router.push(next);
            router.refresh();
        }, 1000);

        return () => clearTimeout(timer);
    }, [next, router]);

    return (
        <div className={styles.page}>
            <div className={styles.backgroundImage} />
            <main className={styles.main}>
                <div className={styles.authContainer}>
                    <p>Securing your session...</p>
                    <div style={{ marginTop: '1rem', width: '20px', height: '20px', border: '2px solid #000', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                </div>
            </main>
            <style jsx global>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

export default function Redirecting() {
    return (
        <Suspense fallback={
            <div className={styles.page}>
                <div className={styles.backgroundImage} />
                <main className={styles.main}>
                    <div className={styles.authContainer}>
                        <p>Loading...</p>
                    </div>
                </main>
            </div>
        }>
            <RedirectingContent />
        </Suspense>
    );
}
