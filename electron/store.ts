import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

const DATA_PATH = app.getPath('userData');
const STORE_FILE = path.join(DATA_PATH, 'julie-store.json');

interface AccountProfile {
    id?: string;
    email?: string | null;
    isPremium?: boolean;
    customPrompt?: string | null;
}

interface StoreData {
    isPremium: boolean;
    apiKey?: string;
    account?: AccountProfile | null;
}

const defaultData: StoreData = {
    isPremium: false,
    account: null,
    apiKey: undefined
};

function loadStore(): StoreData {
    try {
        if (!fs.existsSync(STORE_FILE)) {
            return defaultData;
        }
        const data = fs.readFileSync(STORE_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Failed to load store:", error);
        return defaultData;
    }
}

function saveStore(data: StoreData) {
    try {
        fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Failed to save store:", error);
    }
}

export const Store = {
    getPremiumStatus: (): boolean => {
        const data = loadStore();
        return data.isPremium;
    },
    setPremiumStatus: (status: boolean) => {
        const data = loadStore();
        data.isPremium = status;
        if (data.account) {
            data.account.isPremium = status;
        }
        saveStore(data);
    },
    getApiKey: (): string | undefined => {
        const data = loadStore();
        return data.apiKey;
    },
    setApiKey: (key: string) => {
        const data = loadStore();
        data.apiKey = key;
        saveStore(data);
    },
    getAccountProfile: (): AccountProfile | null => {
        const data = loadStore();
        return data.account ?? null;
    },
    setAccountProfile: (profile: AccountProfile) => {
        const data = loadStore();
        data.account = {
            id: profile.id,
            email: profile.email ?? null,
            customPrompt: profile.customPrompt ?? null,
            isPremium: profile.isPremium
        };
        if (typeof profile.isPremium === 'boolean') {
            data.isPremium = profile.isPremium;
        }
        saveStore(data);
    },
    getAccountState: () => {
        const data = loadStore();
        return {
            profile: data.account ?? null,
            apiKey: data.apiKey,
            isPremium: data.isPremium
        };
    }
};
