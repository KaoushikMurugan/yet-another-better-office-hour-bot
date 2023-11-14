import { environment } from './environment/environment-manager.js';
import { Client, GatewayIntentBits, Options } from 'discord.js';
import { yellow, red } from './utils/command-line-colors.js';
import { Firestore } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { pino, destination } from 'pino';
import path from 'node:path';

const LOG_FILE_NAME = `yabob-prod-application-log-${new Date().valueOf()}.log`;

const LOGGER =
    environment.env === 'development'
        ? pino({
              transport: {
                  target: 'pino-pretty',
                  options: {
                      colorize: true,
                      ignore: 'pid,hostname'
                  }
              }
          })
        : pino(destination(`./${LOG_FILE_NAME}`));

if (environment.env === 'production') {
    console.log(
        `We are in prod, logs are written to ${path.dirname(
            import.meta.url
        )}${LOG_FILE_NAME}`
    );
}

if (
    environment.discordBotCredentials.YABOB_BOT_TOKEN.length === 0 ||
    environment.discordBotCredentials.YABOB_APP_ID.length === 0
) {
    throw new Error(red('Missing token or bot ID. Aborting setup.'));
}

if (
    environment.firebaseCredentials.clientEmail === '' ||
    environment.firebaseCredentials.privateKey === '' ||
    environment.firebaseCredentials.projectId === ''
) {
    throw new Error(red('Missing firebase credentials.'));
}

if (environment.disableExtensions) {
    LOGGER.warn('Running without extensions.');
}

if (getApps().length === 0) {
    initializeApp({
        credential: cert(environment.firebaseCredentials)
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
    .login(environment.discordBotCredentials.YABOB_BOT_TOKEN)
    .then(() => LOGGER.info(`Logged in as ${yellow(client.user.username)}!`))
    .catch((err: Error) => {
        LOGGER.error('Login Unsuccessful. Check YABOBs credentials.');
        throw err;
    });

export { client, firebaseDB, LOGGER };
