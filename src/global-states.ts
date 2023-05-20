import { environment } from './environment/environment-manager.js';
import { Client, GatewayIntentBits, Options } from 'discord.js';
import { yellow, black, red, blue } from './utils/command-line-colors.js';
import { Firestore } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
    console.log(yellow(black('Running without extensions.'), 'Bg'));
}
if (getApps().length === 0) {
    initializeApp({
        credential: cert(environment.firebaseCredentials)
    });
}

/** The following are global constant references */

/** Database object used for backups, shared across base yabob and extensions */
const firebaseDB: Firestore = getFirestore();

/**
 * The discord user object.
 * @remarks Top level await finally works with es-modules
 * - The `true` type parameter asserts that the client has successfully initialized
 * - Asserted because this file handles discord login.
 *  If this object is exported,
 *  then the client is guaranteed have successfully logged in.
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
        ReactionManager: 0,
        GuildBanManager: 0,
        GuildScheduledEventManager: 0,
        MessageManager: 0,
        AutoModerationRuleManager: 0,
        ThreadManager: 0,
        GuildForumThreadManager: 0,
        GuildEmojiManager: 0,
        ThreadMemberManager: 0,
        GuildInviteManager: 0,
        PresenceManager: 0,
        ReactionUserManager: 0,
        GuildTextThreadManager: 0,
        BaseGuildEmojiManager: 0,
        GuildStickerManager: 0,
        StageInstanceManager: 0,
        UserManager: 0,
        ApplicationCommandManager: 0
    })
});

console.log(blue('\nLogging into Discord...'));

/** Login before export */
await client
    .login(environment.discordBotCredentials.YABOB_BOT_TOKEN)
    .then(() => console.log(`\nLogged in as ${yellow(client.user.username)}!`))
    .catch((err: Error) => {
        console.error('Login Unsuccessful. Check YABOBs credentials.');
        throw err;
    });

export { client, firebaseDB };
