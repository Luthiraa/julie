
import puppeteer, { Browser, Page } from 'puppeteer-core';
import path from 'node:path';
import os from 'node:os';

const USER_DATA_DIR = path.join(os.homedir(), '.julie-browser-data');

export class BrowserManager {
    private browser: Browser | null = null;
    private page: Page | null = null;

    async launch() {
        if (this.browser) return;

        // Try connecting to existing Chrome instance on port 9222
        try {
            console.log("Attempting to connect to existing browser on port 9222...");
            this.browser = await puppeteer.connect({
                browserURL: 'http://127.0.0.1:9222',
                defaultViewport: null
            });
            console.log("Connected to existing browser!");
        } catch (e) {
            console.log("No existing debugger found on port 9222. Launching dedicated instance.");
            // Proceed to launch standard instance...

            console.log("Launching browser with data dir:", USER_DATA_DIR);
            console.log("Launching browser with data dir:", USER_DATA_DIR);
            this.browser = await puppeteer.launch({
                headless: false, // User wants to see it
                defaultViewport: null, // Full width
                userDataDir: USER_DATA_DIR,
                executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // Mac fallback
                args: ['--start-maximized']
            });
        }

        const pages = await this.browser.pages();
        this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();
    }

    // Force launch a NEW visible browser (closes existing first)
    async launchFresh() {
        console.log("Launching fresh visible browser...");
        // Close existing
        if (this.browser) {
            try {
                await this.browser.close();
            } catch (e) {
                // Ignore close errors
            }
            this.browser = null;
            this.page = null;
        }

        // Always launch a new one (skip 9222 connection attempt)
        this.browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            userDataDir: USER_DATA_DIR,
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // Mac fallback
            args: ['--start-maximized', '--new-window']
        });

        const pages = await this.browser.pages();
        this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();
        return "Fresh browser launched.";
    }

    private async ensurePage() {
        if (!this.browser || !this.page) {
            await this.launch();
        }
        return this.page!;
    }

    async navigate(url: string) {
        const p = await this.ensurePage();
        if (!url.startsWith('http')) url = 'https://' + url;
        await p.goto(url, { waitUntil: 'domcontentloaded' });
        return `Navigated to ${url}`;
    }

    async click(selector: string) {
        const p = await this.ensurePage();
        try {
            await p.waitForSelector(selector, { timeout: 5000 });
            await p.click(selector);
            return `Clicked ${selector}`;
        } catch (e: any) {
            return `Error clicking ${selector}: ${e.message}`;
        }
    }

    async type(selector: string, text: string) {
        const p = await this.ensurePage();
        try {
            await p.waitForSelector(selector, { timeout: 5000 });
            await p.type(selector, text);
            return `Typed "${text}" into ${selector}`;
        } catch (e: any) {
            return `Error typing into ${selector}: ${e.message}`;
        }
    }

    async press_key(key: string) {
        const p = await this.ensurePage();
        try {
            await p.keyboard.press(key as any);
            return `Pressed key: ${key}`;
        } catch (e: any) {
            return `Error pressing key ${key}: ${e.message}`;
        }
    }

    async scroll(direction: 'up' | 'down') {
        const p = await this.ensurePage();
        await p.evaluate((dir) => {
            window.scrollBy(0, dir === 'down' ? window.innerHeight * 0.8 : -window.innerHeight * 0.8);
        }, direction);
        return `Scrolled ${direction}`;
    }

    async readPage() {
        const p = await this.ensurePage();

        // Enhanced extraction for better AI understanding
        const content = await p.evaluate(() => {
            const cleanText = (text: string) => text.replace(/\s+/g, ' ').trim().substring(0, 100);

            // Build unique, reliable selectors
            const getSelector = (el: Element, index: number): string => {
                // Priority 1: data-testid (most reliable)
                if (el.hasAttribute('data-testid')) {
                    return `[data-testid="${el.getAttribute('data-testid')}"]`;
                }
                // Priority 2: ID
                if (el.id) {
                    return `#${el.id}`;
                }
                // Priority 3: aria-label
                if (el.getAttribute('aria-label')) {
                    return `[aria-label="${el.getAttribute('aria-label')}"]`;
                }
                // Priority 4: name attribute (for forms)
                if (el.getAttribute('name')) {
                    return `[name="${el.getAttribute('name')}"]`;
                }
                // Priority 5: role + text combo (Using standard selector, NO :has-text)
                // We return a "hint" for the user/model, but for actual clicking we need a robust path
                // Since :has-text is non-standard, we fallback to index based or just return the tag for now
                // Ideally we'd use XPath, but for simplicity let's rely on structural attributes
                const role = el.getAttribute('role');
                if (role) {
                    return `[role="${role}"]`;
                }

                // Priority 6: Standard class (if unique-ish)
                if (el.className && typeof el.className === 'string' && el.className.trim().length > 0) {
                    const cls = el.className.split(' ')[0];
                    if (cls) return `.${cls}`;
                }

                // Fallback: tag + nth-of-type
                return `${el.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
            };

            // Get clickable elements
            const clickables = Array.from(document.querySelectorAll('button, a, [role="button"], [onclick], input[type="submit"]'))
                .slice(0, 50)
                .map((el, idx) => {
                    const text = cleanText((el as HTMLElement).innerText || (el as HTMLInputElement).value || '');
                    const ariaLabel = el.getAttribute('aria-label') || '';
                    const label = text || ariaLabel || '(no text)';
                    const selector = getSelector(el, idx);
                    return `• CLICK: "${label}" → selector: ${selector}`;
                })
                .filter(Boolean);

            // Get input fields
            const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea'))
                .slice(0, 15)
                .map((el, idx) => {
                    const placeholder = (el as HTMLInputElement).placeholder || '';
                    const name = el.getAttribute('name') || '';
                    const label = placeholder || name || '(unnamed input)';
                    const selector = getSelector(el, idx);
                    return `• INPUT: "${label}" → selector: ${selector}`;
                });

            // Get page summary text
            const bodyText = document.body.innerText.split('\n')
                .map(line => cleanText(line))
                .filter(line => line.length > 30)
                .slice(0, 10)
                .join('\n');

            return `=== PAGE INFO ===
Title: ${document.title}
URL: ${document.location.href}

=== CLICKABLE ELEMENTS ===
${clickables.join('\n')}

=== INPUT FIELDS ===
${inputs.join('\n')}

=== PAGE TEXT (Preview) ===
${bodyText}`;
        });

        return content;
    }

    async getUrl() {
        const p = await this.ensurePage();
        return p.url();
    }

    async executeScript(script: string) {
        const p = await this.ensurePage();
        try {
            const result = await p.evaluate(script); // Be careful with this!
            return `Executed script. Result: ${JSON.stringify(result)}`;
        } catch (e: any) {
            return `Script error: ${e.message}`;
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
        return "Browser closed.";
    }
}
