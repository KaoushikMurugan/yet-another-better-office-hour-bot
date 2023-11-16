declare global {
    namespace NodeJS {
        interface ProcessEnv {
            NODE_ENV: 'development' | 'production';
            APP_ID: string;
            BOT_TOKEN: string;
            GOOGLE_SHEET_ID: string;
            DEFAULT_CALENDAR_ID: string;
            GOOGLE_API_KEY: string;
            FIREBASE_PROJECT_ID: string;
            FIREBASE_PRIVATE_KEY: string;
            FIREBASE_CLIENT_EMAIL: string;
            GOOGLE_CLOUD_CLIENT_EMAIL: string;
            GOOGLE_CLOUD_PRIVATE_KEY: string;
            NO_EXTENSION: 'true' | 'false';
        }
    }
}

export {};
