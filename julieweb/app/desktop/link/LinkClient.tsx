'use client';

import { useState } from "react";
import styles from "../../page.module.css";

type Profile = {
    isPremium: boolean;
    customPrompt: string;
};

type Props = {
    code: string | null;
    user: {
        id: string;
        email: string | null;
    };
    profile: Profile;
};

export function LinkClient({ code, user, profile }: Props) {
    const [prompt, setPrompt] = useState(profile.customPrompt);
    const [apiKey, setApiKey] = useState("");
    const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
    const [message, setMessage] = useState<string>("");

    const handleSync = async () => {
        if (!code) {
            setMessage("Missing link code. Restart the process from the desktop app.");
            setStatus("error");
            return;
        }
        if (!profile.isPremium && !apiKey.trim().startsWith("gsk_")) {
            setMessage("Enter a valid Groq key (starts with gsk_).");
            setStatus("error");
            return;
        }

        setStatus("saving");
        setMessage("Linking with Julie...");
        try {
            if (profile.isPremium && prompt !== profile.customPrompt) {
                const profileResponse = await fetch("/api/desktop/profile", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ customPrompt: prompt })
                });
                if (!profileResponse.ok) {
                    throw new Error("Failed to save prompt");
                }
            }

            const response = await fetch("/api/desktop/link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code,
                    apiKey: profile.isPremium ? undefined : apiKey.trim(),
                    customPrompt: profile.isPremium ? prompt : undefined
                })
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.error || "Linking failed");
            }

            window.location.href = "/desktop/linked";
        } catch (error) {
            console.error(error);
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Something went wrong. Try again.");
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.backgroundImage} />
            <main className={styles.main}>
                <div className={styles.authContainer} style={{ maxWidth: "640px" }}>
                    <p className={styles.tagline} style={{ fontSize: "1.5rem" }}>
                        Link Julie to {user.email}
                    </p>
                    <p className={styles.body} style={{ marginBottom: "1.5rem" }}>
                        Finish setup here, then return to the desktop app. Julie will refresh automatically.
                    </p>

                    {!code && (
                        <p className={styles.body} style={{ color: '#ffcc00', marginBottom: '1rem', background: 'rgba(255,204,0,0.1)', padding: '8px', borderRadius: '6px' }}>
                            Warning: No link code detected. Linking will likely fail. Please restart from the desktop app.
                        </p>
                    )}

                    {profile.isPremium ? (
                        <>
                            <label className={styles.body} style={{ marginBottom: "0.5rem" }}>
                                Custom Julie Prompt
                            </label>
                            <textarea
                                className={styles.authInput}
                                style={{ minHeight: "140px" }}
                                placeholder="Describe the behavior Julie should follow…"
                                value={prompt}
                                onChange={(event) => {
                                    setPrompt(event.target.value);
                                    setStatus("idle");
                                    setMessage("");
                                }}
                            />
                        </>
                    ) : (
                        <>
                            <label className={styles.body} style={{ marginBottom: "0.5rem" }}>
                                Groq API Key
                            </label>
                            <input
                                type="password"
                                className={styles.authInput}
                                placeholder="gsk_..."
                                value={apiKey}
                                onChange={(event) => {
                                    setApiKey(event.target.value);
                                    setStatus("idle");
                                    setMessage("");
                                }}
                            />
                        </>
                    )}

                    <button
                        className={styles.authButton}
                        style={{ marginTop: "1.5rem" }}
                        type="button"
                        onClick={handleSync}
                        disabled={status === "saving"}
                    >
                        {status === "saving" ? "Linking…" : "Send to Julie"}
                    </button>

                    {message && (
                        <p
                            className={styles.body}
                            style={{
                                color: status === "error" ? "#d93025" : "#0f9d58",
                                marginTop: "1rem"
                            }}
                        >
                            {message}
                        </p>
                    )}
                </div>
            </main>
        </div>
    );
}
