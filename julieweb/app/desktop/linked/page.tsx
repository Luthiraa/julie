import Link from "next/link";
import styles from "../../page.module.css";

export default function DesktopLinkedSuccess() {
    return (
        <div className={styles.page}>
            <div className={styles.backgroundImage} />
            <main className={styles.main}>
                <div className={styles.authContainer} style={{ maxWidth: "520px" }}>
                    <h2 className={styles.tagline} style={{ fontSize: "2rem", marginBottom: "1rem" }}>
                        Link successful
                    </h2>
                    <p className={styles.body} style={{ marginBottom: "1rem" }}>
                        Your Julie desktop app is refreshing with this account’s settings. You can close this tab.
                    </p>
                    <p className={styles.body} style={{ marginBottom: "2rem" }}>
                        Return to Julie and you should see your plan status updated. If nothing changes, re-open Julie and click Settings again.
                    </p>
                    <Link href="/downloads" className={styles.authButton}>
                        Return to Julie
                    </Link>
                </div>
            </main>
        </div>
    );
}
