import { Client, GatewayIntentBits, Options } from 'discord.js';
import { yellow, red } from './utils/command-line-colors.js';
import { Firestore } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { pino, destination } from 'pino';

const LOGGER =
    process.env.NODE_ENV === 'development'
        ? pino({
              transport: {
                  target: 'pino-pretty',
                  options: {
                      colorize: true,
                      ignore: 'pid,hostname'
                  }
              }
          })
        : pino(destination(process.stdout)); // write to stdout to let pm2 handle log rotation

if (process.env.NODE_ENV === 'production') {
    console.log(`We are in prod, logs are written to PM2's log files`);
}

if (process.env.BOT_TOKEN.length === 0 || process.env.APP_ID.length === 0) {
    throw new Error(red('Missing token or bot ID. Aborting setup.'));
}

if (
    process.env.FIREBASE_CLIENT_EMAIL === '' ||
    process.env.FIREBASE_PRIVATE_KEY === '' ||
    process.env.FIREBASE_PROJECT_ID === ''
) {
    throw new Error(red('Missing firebase credentials.'));
}

if (process.env.NO_EXTENSION === 'true') {
    LOGGER.warn('Running without extensions.');
}


if (getApps().length === 0) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: JSON.parse(process.env.FIREBASE_PRIVATE_KEY)
        })
    });
}

// The following are global constants

/**
 * Database object used for backups, shared across base yabob and extensions
 */
const firebaseDB: Firestore = getFirestore();

/**
 * The discord user object.
 * If this object is exported, then the client is guaranteed have successfully logged in.
 */
const client: Client<true> = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ],
    // modifies default caching behavior
    makeCache: Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        ReactionManager: 0,
        GuildBanManager: 0,
        GuildScheduledEventManager: 0,
        MessageManager: 0,
        AutoModerationRuleManager: 0,
        ApplicationCommandManager: 0
    })
});

/** Login before export */
await client
    .login(process.env.BOT_TOKEN)
    .then(() => LOGGER.info(`Logged in as ${yellow(client.user.username)}!`))
    .catch((err: Error) => {
        LOGGER.error('Login Unsuccessful. Check YABOBs credentials.');
        throw err;
    });

export { client, firebaseDB, LOGGER };
