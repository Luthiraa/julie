
import puppeteer, { Browser, Page } from 'puppeteer';
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
            this.browser = await puppeteer.launch({
                headless: false, // User wants to see it
                defaultViewport: null, // Full width
                userDataDir: USER_DATA_DIR,
                args: ['--start-maximized']
            });
        }

        const pages = await this.browser.pages();
        this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();
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

    async scroll(direction: 'up' | 'down') {
        const p = await this.ensurePage();
        await p.evaluate((dir) => {
            window.scrollBy(0, dir === 'down' ? window.innerHeight * 0.8 : -window.innerHeight * 0.8);
        }, direction);
        return `Scrolled ${direction}`;
    }

    async readPage() {
        const p = await this.ensurePage();

        // Simple extraction strategy: get visible text or interactable elements
        // For now, we'll return a simplified markdown of the body text to give context
        const content = await p.evaluate(() => {
            // Helper to get minimal useful text
            const cleanText = (text: string) => text.replace(/\s+/g, ' ').trim();

            // Get all buttons and links for context
            const interactables = Array.from(document.querySelectorAll('button, a, input, textarea, [role="button"]'))
                .slice(0, 50) // Limit to avoid token overflow
                .map(el => {
                    const tag = el.tagName.toLowerCase();
                    const text = (el as HTMLElement).innerText || (el as HTMLInputElement).placeholder || (el as HTMLInputElement).value || '';
                    const clean = cleanText(text);
                    if (!clean) return null;

                    // Try to generate a unique selector
                    let selector = tag;
                    if (el.id) selector += `#${el.id}`;
                    else if (el.hasAttribute('data-testid')) selector += `[data-testid="${el.getAttribute('data-testid')}"]`;
                    else if (el.getAttribute('aria-label')) selector += `[aria-label="${el.getAttribute('aria-label')}"]`;
                    else if (el.getAttribute('name')) selector += `[name="${el.getAttribute('name')}"]`;
                    else if (el.className && typeof el.className === 'string') selector += `.${el.className.split(' ')[0]}`;

                    // Add important attributes to description
                    const ariaLabel = el.getAttribute('aria-label') ? `(Label: "${el.getAttribute('aria-label')}")` : '';

                    if (!clean && !ariaLabel) return null;

                    return `[${tag}] ${clean} ${ariaLabel} (Selector: ${selector})`;
                })
                .filter(Boolean);

            const bodyText = document.body.innerText.split('\n')
                .map(line => cleanText(line))
                .filter(line => line.length > 20) // Filter short noise
                .slice(0, 20) // Limit body text
                .join('\n');

            return `--- Page Content ---\nTitle: ${document.title}\nURL: ${document.location.href}\n\n--- Interactable Elements (Sample) ---\n${interactables.join('\n')}\n\n--- Main Text Preview ---\n${bodyText}`;
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
