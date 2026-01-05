<div align="center">
  <img src="public/newIcon.png" alt="Julie Icon" width="120" height="120" />
  <h1>Julie</h1>
  <p>
    <strong>An agentic, screen-aware desktop AI assistant for an unfair productivity advantage.</strong>
  </p>
  <p>
    <a href="https://github.com/Luthiraa/julie/releases">
      <img src="https://img.shields.io/github/v/release/Luthiraa/julie?style=flat-square&color=black" alt="Latest Release" />
    </a>
    <a href="#license">
      <img src="https://img.shields.io/badge/license-MIT-gray?style=flat-square" alt="License" />
    </a>
  </p>
</div>

---

Julie is a lightweight, transparent desktop AI assistant built to reduce context switching.
It lives on top of your workspace, understands what's on your screen, and responds via voice or text without forcing you to switch tabs, copy context, or break focus.

Julie is also **agentic** — it can autonomously control your browser, execute terminal commands, and interact with your computer using mouse and keyboard actions.

Built in a weekend to see if it was possible, and open-sourced for anyone who wants to explore or extend it.

## Downloads

Get the latest version from the **[Releases Page](https://github.com/Luthiraa/julie/releases)**.

| OS | Architecture | Installer |
| :--- | :--- | :--- |
| **macOS** | Apple Silicon (M1/M2/M3) | [`Julie-0.0.1-arm64.dmg`](https://github.com/Luthiraa/julie/releases/download/v0.0.1/Julie-0.0.1-arm64.dmg) |
| **Windows** | x64 (Standard) | [`Julie-Setup-0.0.1-x64.exe`](https://github.com/Luthiraa/julie/releases/download/v0.0.1/Julie-Setup-0.0.1-x64.exe) |
| **Windows** | ARM64 (Surface/Snapdragon) | [`Julie-Setup-0.0.1-arm64.exe`](https://github.com/Luthiraa/julie/releases/download/v0.0.1/Julie-Setup-0.0.1-arm64.exe) |

## Features

*   **Invisible Interface**: A transparent window that blends into your desktop.
*   **Ghost Mode**: Click-through capability (`Cmd+Shift+I`) to keep Julie visible while you work.
*   **AI-Powered**: Uses **Groq** (Llama 3 70B & Llama 4 Scout) for instant, reasoning-heavy responses.
*   **Vision**: One-click analysis of your current screen content.

## Agentic Capabilities

Julie can autonomously perform tasks on your behalf using the following tools:

### Browser Automation
Control a web browser (powered by Puppeteer) to:
*   **Navigate** to any URL
*   **Click** on elements using CSS selectors
*   **Type** text into input fields
*   **Scroll** pages up or down
*   **Read** page content and interactable elements
*   **Execute** custom JavaScript

### Computer Use (macOS)
Native system control via JXA (JavaScript for Automation):
*   **Mouse Movement** — Move cursor to specific coordinates
*   **Click Actions** — Left click, right click, double click
*   **Drag & Drop** — Drag from one point to another
*   **Scroll** — Scroll at any position on screen
*   **Screen Info** — Get screen size and cursor position

### Keyboard Control
*   **Type Text** — Simulate keyboard input to any active window

### Terminal Execution
*   **Run Commands** — Execute shell commands directly from the assistant

## Shortcuts

| Action | macOS | Windows |
| :--- | :--- | :--- |
| **Ghost Mode** | `Cmd + Shift + I` | `Ctrl + Shift + I` |
| **Toggle Visibility** | `Cmd + ]` | `Ctrl + ]` |
| **Move Window** | `Cmd + Arrow Keys` | `Ctrl + Arrow Keys` |

## Setup

1.  **Install**: Download and install the app for your OS.
2.  **Configure API**:
    *   Launch Julie.
    *   Click the **Grid Icon** to open Settings.
    *   Enter your **[Groq API Key](https://console.groq.com/keys)** (starts with `gsk_`).
    *   Click **Save**.
3.  **Chat**: Type or speak to start. Use **Smart Mode** for complex queries.
