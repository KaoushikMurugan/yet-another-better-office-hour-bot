import { AttendingServerV2 } from './attending-server/base-attending-server.js';
import { GuildId } from './utils/type-aliases.js';
import { environment } from './environment/environment-manager.js';
import { Collection, Client, GatewayIntentBits } from 'discord.js';
import { yellow, black, red } from './utils/command-line-colors.js';
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

/** Datatbase object used for backups, shared across base yabob and extensions */
const firebaseDB: Firestore = getFirestore();

/**
 * The discord user object.
 * @remarks Top level await finally works with esmodules,
 * this can now be safely referenced at the top leve;
 * - The `true` type parameter asserts that the client has successfully initialized
 * - Asserted because this file handles discord login.
 * - If this object is successfullt exported, then it's guaranteed to be logged in.
 */
const client: Client<true> = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ]
});

/**
 * All the servers that YABOB is managing
 * @remark Do NOT call the {@link AttendingServerV2} methods (except getters)
 * without passing through a interaction handler first
 */
const attendingServers: Collection<GuildId, AttendingServerV2> = new Collection();

/**
 * Login before export
 */
await client
    .login(environment.discordBotCredentials.YABOB_BOT_TOKEN)
    .then(() => console.log(`\nLogged in as ${yellow(client.user.username)}!`))
    .catch((err: Error) => {
        console.error('Login Unsuccessful. Check YABOBs credentials.');
        throw err;
    });

export { attendingServers, client, firebaseDB };
