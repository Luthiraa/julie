import Link from "next/link";
import styles from "./page.module.css";

export default function Downloads() {
    const releaseUrl = "https://github.com/Luthiraa/julie/releases/tag/v1.2.0";

    // Fallback link if direct downloads fail, though these are standard guesses
    // Ideally we'd fetch these dynamically or use a reliable latest link, 
    // but for this task we point to the release page to be safe for the user.

    return (
        <div className={styles.page}>
            <div className={styles.backgroundImage} />

            <main className={styles.main}>
                <div className={styles.column}>
                    <Link href="/" className={styles.backLink}>
                        ← Back
                    </Link>

                    <div>
                        <h1 className={styles.title}>Download Julie</h1>
                        <p className={styles.version}>Release v1.2.0</p>
                    </div>

                    <div className={styles.buttonGroup}>
                        <a href="https://github.com/Luthiraa/julie/releases/download/v1.2.0/Julie-1.2.0-arm64.dmg" className={styles.downloadButton}>
                            <div>
                                <div className={styles.buttonLabel}>Download for Mac</div>
                                <div className={styles.buttonSub}>Apple Silicon (.dmg)</div>
                            </div>
                            <span>↓</span>
                        </a>

                        <a href="https://github.com/Luthiraa/julie/releases" target="_blank" rel="noopener noreferrer" className={styles.downloadButton}>
                            <div>
                                <div className={styles.buttonLabel}>View all releases</div>
                                <div className={styles.buttonSub}>GitHub</div>
                            </div>
                            <span>→</span>
                        </a>
                    </div>
                </div>

                <footer className={styles.footer}>
                    <a href="https://github.com/Luthiraa/julie">Github</a>
                    <Link href="/story">Story</Link>
                </footer>
            </main>
        </div>
    );
}
