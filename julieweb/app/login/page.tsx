import { signInWithGoogle, login } from "../auth/actions";
import Image from "next/image";
import Link from "next/link";
import styles from "../page.module.css";

type Props = {
    searchParams: {
        next?: string;
    };
};

export default function Login({ searchParams }: Props) {
    const nextPath = typeof searchParams?.next === "string" ? searchParams.next : "/api/checkout";
    return (
        <div className={styles.page}>
            <div className={styles.backgroundImage} />

            <main className={styles.main}>
                <div className={styles.logo}>
                    <Link href="/">
                        <Image src="/icon.png" alt="Julie" width={25} height={25} unoptimized />
                    </Link>
                </div>

                <div className={styles.authContainer}>
                    <h2 className={styles.tagline} style={{ fontSize: '1.25rem', marginBottom: '2rem' }}>Welcome back</h2>

                    <form>
                        <input type="hidden" name="next" value={nextPath} />
                        <input type="email" name="email" placeholder="Email address" className={styles.authInput} required />
                        <input type="password" name="password" placeholder="Password" className={styles.authInput} required />
                        <button formAction={login} className={styles.authButton}>Log In</button>
                    </form>

                    <div className={styles.authDivider}>OR</div>

                    <form action={signInWithGoogle}>
                        <input type="hidden" name="next" value={nextPath} />
                        <button type="submit" className={`${styles.authButton} ${styles.googleButton}`}>
                            {/* Google 'G' Logo SVG */}
                            <svg width="20" height="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                                <path fill="none" d="M0 0h48v48H0z" />
                            </svg>
                            <span>Sign in with Google</span>
                        </button>
                    </form>

                    <Link href={`/signup?next=${encodeURIComponent(nextPath)}`} className={styles.authLink}>
                        Don't have an account? Sign up
                    </Link>
                </div>

                <footer className={styles.footer}>
                    <a href="https://github.com/Luthiraa/julie">Github</a>
                    <Link href="/story">Story</Link>
                    <Link href="/pricing">Pricing</Link>
                </footer>
            </main>
        </div>
    );
}
