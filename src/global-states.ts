import { AttendingServerV2 } from './attending-server/base-attending-server';
import { GuildId } from './utils/type-aliases';
import environment from './environment/environment-manager';
import { Collection, Client, GatewayIntentBits } from 'discord.js';
import { yellow, black } from './utils/command-line-colors';

if (
    environment.discordBotCredentials.YABOB_BOT_TOKEN.length === 0 ||
    environment.discordBotCredentials.YABOB_APP_ID.length === 0
) {
    throw new Error('Missing token or bot ID. Aborting setup.');
}
if (environment.disableExtensions) {
    console.log(yellow(black('Running without extensions.'), 'Bg'));
}

const client = new Client({
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

client.login(environment.discordBotCredentials.YABOB_BOT_TOKEN).catch((err: Error) => {
    console.error('Login Unsuccessful. Check YABOBs credentials.');
    throw err;
});

const attendingServers: Collection<GuildId, AttendingServerV2> = new Collection();

export { attendingServers, client };
