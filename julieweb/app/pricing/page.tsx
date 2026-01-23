import Image from "next/image";
import Link from "next/link";
import styles from "../page.module.css";

export default function Pricing() {
    return (
        <div className={styles.page}>
            <div className={styles.backgroundImage} />

            <main className={styles.main}>
                <div className={styles.logo}>
                    <Link href="/">
                        <Image src="/icon.png" alt="Julie" width={25} height={25} unoptimized />
                    </Link>
                </div>

                <div className={styles.pricingIntro}>
                    <p className={styles.tagline} style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
                        Simple, transparent pricing.
                    </p>
                    <p className={styles.body} style={{ textAlign: 'center' }}>
                        Valid intelligence for your workflow. No hidden fees. Cancel anytime.
                    </p>
                </div>

                <div className={styles.pricingGrid}>
                    {/* Free Plan */}
                    <div className={styles.pricingCard}>
                        <div className={styles.pricingHeader}>
                            <h3 className={styles.cardTitle}>Julie Core</h3>
                            <div className={styles.cardPrice}>Free<span></span></div>
                        </div>
                        <ul className={styles.cardFeatures}>
                            <li>100% free & open source</li>
                            <li>Bring your own model(BYOM) / API key</li>
                            <li>Local screen understanding</li>
                            <li>Standard chat interface</li>
                            <li>Runs fully on your machine</li>
                        </ul>
                        <a href="#" className={styles.cardButton}>Download</a>
                    </div>
                    {/* Pro Plan */}
                    <div className={`${styles.pricingCard} ${styles.premium}`}>
                        <div className={styles.pricingHeader}>
                            <h3 className={styles.cardTitle}>Julie Zero</h3>
                            <div className={styles.cardPrice}>$9.99<span>/mo</span></div>
                        </div>
                        <ul className={styles.cardFeatures}>
                            <li><strong>Zero setup, works instantly</strong></li>
                            <li>Unlimited usage & requests</li>
                            <li>No API keys or configuration</li>
                            <li>Autonomous browser & terminal agents</li>
                            <li>Managed cloud compute</li>
                        </ul>
                        <Link href="/signup" className={`${styles.cardButton} ${styles.primary}`}>Subscribe</Link>
                    </div>
                </div>

                <footer className={styles.footer}>
                    <a href="https://github.com/Luthiraa/julie">Github</a>
                    <Link href="/story">Story</Link>
                    <Link href="/pricing" style={{ borderBottom: '1px solid currentColor' }}>Pricing</Link>
                </footer>
            </main>
        </div>
    );
}
