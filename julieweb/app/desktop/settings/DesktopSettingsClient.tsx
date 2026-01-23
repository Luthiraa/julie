'use client';

import { useMemo, useState } from "react";
import styles from "../../page.module.css";

type Props = {
    user: {
        id: string;
        email: string | null;
    };
    isPremium: boolean;
    customPrompt: string;
    linkCode: string | null;
};

export function DesktopSettingsClient({ user, isPremium, customPrompt, linkCode }: Props) {
    const [prompt, setPrompt] = useState(customPrompt);
    const [apiKey, setApiKey] = useState("");
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [linkState, setLinkState] = useState<"idle" | "sending" | "linked" | "error">("idle");
    const [linkMessage, setLinkMessage] = useState("");

    const description = useMemo(() => {
        if (isPremium) {
            return "Define the default instructions Julie should follow when you trigger automations.";
        }
        return "Bring your own Groq API key to unlock Julie locally. Upgrade to Premium to skip this step.";
    }, [isPremium]);

    const handlePromptSave = async () => {
        setSaveState("saving");
        try {
            const response = await fetch("/api/desktop/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customPrompt: prompt })
            });
            if (!response.ok) {
                throw new Error("Failed to save prompt");
            }
            setSaveState("saved");
        } catch (error) {
            console.error(error);
            setSaveState("error");
        }
    };

    const handleLinkDesktop = async () => {
        if (!linkCode) {
            setLinkState("error");
            setLinkMessage("Open Julie on your desktop and click Settings to generate a link.");
            return;
        }
        if (!isPremium && !apiKey.trim().startsWith("gsk_")) {
            setLinkState("error");
            setLinkMessage("Enter a valid Groq key (gsk_...).");
            return;
        }
        setLinkState("sending");
        setLinkMessage("Sending securely to Julie...");
        try {
            const response = await fetch("/api/desktop/link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code: linkCode,
                    apiKey: isPremium ? undefined : apiKey.trim()
                })
            });
            if (!response.ok) {
                throw new Error("Failed to link");
            }
            setLinkState("linked");
            setLinkMessage("Linked. Return to the desktop app—Julie will finish connecting automatically.");
        } catch (error) {
            console.error(error);
            setLinkState("error");
            setLinkMessage("Could not reach Julie. Refresh and try again.");
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.backgroundImage} />
            <main className={styles.main}>
                <div className={styles.authContainer} style={{ maxWidth: "640px" }}>
                    <div style={{ marginBottom: "2rem" }}>
                        <p className={styles.tagline} style={{ fontSize: "1.5rem" }}>
                            Desktop Settings
                        </p>
                        <p className={styles.body}>
                            Signed in as <strong>{user.email}</strong>
                        </p>
                        <p className={styles.body}>{description}</p>
                        {linkCode ? (
                            <p className={styles.body} style={{ color: "#bbb" }}>
                                Secure link code: <code>{linkCode}</code>
                            </p>
                        ) : (
                            <p className={styles.body} style={{ color: "#d93025" }}>
                                Launch Julie on desktop and click Settings to generate a new link.
                            </p>
                        )}
                    </div>

                    {isPremium ? (
                        <>
                            <label className={styles.body} style={{ marginBottom: "0.5rem" }}>
                                Custom Julie Prompt
                            </label>
                            <textarea
                                className={styles.authInput}
                                style={{ minHeight: "140px" }}
                                placeholder="Describe the behavior you want Julie to follow…"
                                value={prompt}
                                onChange={(event) => {
                                    setPrompt(event.target.value);
                                    setSaveState("idle");
                                }}
                            />
                            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                                <button
                                    className={styles.authButton}
                                    type="button"
                                    onClick={handlePromptSave}
                                    disabled={saveState === "saving"}
                                >
                                    {saveState === "saving" ? "Saving…" : "Save prompt"}
                                </button>
                                <button
                                    className={`${styles.authButton}`}
                                    type="button"
                                    onClick={handleLinkDesktop}
                                    disabled={linkState === "sending"}
                                >
                                    {linkState === "sending" ? "Linking…" : "Send to desktop"}
                                </button>
                            </div>
                            {saveState === "saved" && (
                                <p className={styles.body} style={{ color: "#0f9d58" }}>
                                    Prompt saved.
                                </p>
                            )}
                            {saveState === "error" && (
                                <p className={styles.body} style={{ color: "#d93025" }}>
                                    Could not save prompt. Try again.
                                </p>
                            )}
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
                                    setLinkState("idle");
                                    setLinkMessage("");
                                }}
                            />
                            <button
                                className={styles.authButton}
                                type="button"
                                onClick={handleLinkDesktop}
                                disabled={linkState === "sending"}
                            >
                                {linkState === "sending" ? "Linking…" : "Send key to desktop"}
                            </button>
                        </>
                    )}

                    {linkMessage && (
                        <p
                            className={styles.body}
                            style={{
                                color: linkState === "error" ? "#d93025" : "#0f9d58",
                                marginTop: "1rem"
                            }}
                        >
                            {linkMessage}
                        </p>
                    )}
                </div>
            </main>
        </div>
    );
}
