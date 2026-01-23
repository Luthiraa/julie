import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <div className={styles.backgroundImage} />

      <main className={styles.main}>
        <div className={styles.column}>
          <div className={styles.logo}>
            <Image src="/icon.png" alt="Julie" width={25} height={25} unoptimized />
          </div>

          <p className={styles.tagline}>
            Julie is for people who want the power of an AI copilot without inviting a second workspace into their life.
          </p>

          <p className={styles.body}>
            We're building an overlay layer for knowledge work. Julie sits quietly on top of your apps, sees what you're looking at, and helps in real time — whether you're writing, coding, researching, or stuck mid-call. The interface is intentionally minimal. The goal isn't to chat with an assistant. It's to get unstuck fast, then disappear.
          </p>

          <p className={styles.body}>
            Most assistants expect you to paste context and explain yourself. Julie flips that. Your screen is the context. What you're reading, writing, or debugging becomes the input, so help shows up exactly where and when you need it.
          </p>

          <p className={styles.body}>
            Julie also goes beyond single prompts. It has agents that can write for you, refactor code, and carry work across multiple steps without constant back-and-forth. Over time, those agents extend into automating computer actions like navigating interfaces, moving between apps, and handling repetitive tasks — so less effort goes into managing tools and more into actual thinking.
          </p>

          <p className={styles.body}>
            The result is an assistant that feels less like another product and more like a layer of intelligence woven directly into how you already work.
          </p>
        </div>

        <footer className={styles.footer}>
          <a href="https://github.com/Luthiraa/julie">Github</a>
          <Link href="/story">Story</Link>
          <Link href="/downloads">Downloads</Link>
          <Link href="/pricing">Pricing</Link>
        </footer>
      </main>
    </div >
  );
}
