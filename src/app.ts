import { Guild, Collection, Interaction } from 'discord.js';
import { AttendingServerV2 } from './attending-server/base-attending-server.js';
import {
    builtInButtonHandlerCanHandle,
    builtInDMButtonHandlerCanHandle,
    processBuiltInButton,
    processBuiltInDMButton,
    builtInCommandHandlerCanHandle,
    processBuiltInCommand,
    builtInDMModalHandlerCanHandle,
    builtInModalHandlerCanHandle,
    processBuiltInDMModalSubmit,
    processBuiltInModalSubmit
} from './command-handling/interaction-index.js';
import { magenta, cyan, green, red, yellow } from './utils/command-line-colors.js';
import { postSlashCommands } from './command-handling/slash-commands.js';
import { EmbedColor, SimpleEmbed } from './utils/embed-helper.js';
import { CalendarInteractionExtension } from './extensions/session-calendar/command-handling/calendar-command-extension.js';
import { IInteractionExtension } from './extensions/extension-interface.js';
import { GuildId } from './utils/type-aliases.js';
import { client, attendingServers } from './global-states.js';
import { environment } from './environment/environment-manager.js';
import { updatePresence } from './utils/discord-presence.js';
import {
    centered,
    printTitleString,
    isLeaveVC,
    isJoinVC
} from './utils/util-functions.js';
import { UnexpectedParseErrors } from './command-handling/expected-interaction-errors.js';
import {
    builtInDMSelectMenuHandlerCanHandle,
    builtInSelectMenuHandlerCanHandle,
    processBuiltInDMSelectMenu,
    processBuiltInSelectMenu
} from './command-handling/select-menu-handler.js';
import { serverRolesConfigMenu } from './attending-server/server-settings-menus.js';

const interactionExtensions = new Collection<GuildId, IInteractionExtension[]>();
const failedInteractions: { username: string; interaction: Interaction }[] = [];

/**
 * After login startup seqence
 */
client.on('ready', async () => {
    printTitleString();
    // completeGuilds is all the servers this YABOB instance has joined
    const clientGuilds = await client.guilds.fetch();
    const completeGuilds = await Promise.all(clientGuilds.map(guild => guild.fetch()));
    const setupResults = await Promise.allSettled(
        completeGuilds.map(guild => joinGuild(guild))
    );
    setupResults.forEach(
        result => result.status === 'rejected' && console.log(`${result.reason}`)
    );
    if (setupResults.filter(result => result.status === 'fulfilled').length === 0) {
        console.error('All server setups failed. Aborting.');
        process.exit(1);
    }
    updatePresence();
    setInterval(updatePresence, 1000 * 60 * 30);
    console.log(`\n✅ ${green('Ready to go!')} ✅\n`);
    console.log(`${centered('-------- Begin Server Logs --------')}\n`);
});

/**
 * Server joining procedure
 */
client.on('guildCreate', async guild => {
    console.log(`${magenta('Got invited to:')} '${guild.name}'!`);
    await joinGuild(guild).catch(() =>
        console.error(`${red('Please give me the highest role in:')} '${guild.name}'.`)
    );
});

/**
 * Server exit procedure
 * - Clears all the periodic updates
 * - Deletes server from server map
 */
client.on('guildDelete', async guild => {
    const server = attendingServers.get(guild.id);
    if (server !== undefined) {
        server.clearAllServerTimers();
        await server.gracefulDelete();
        attendingServers.delete(guild.id);
        console.log(
            red(`Leaving ${guild.name}. Backups will be saved by the extensions.`)
        );
    }
});

/**
 * Handles all interactions
 * - Slash commands
 * - Button presses
 * - Modal submissions
 */
client.on('interactionCreate', async (interaction: Interaction) => {
    if (interaction.channel?.isDMBased()) {
        dispatchDMInteraction(interaction).catch((err: Error) => {
            interaction.user
                .send(UnexpectedParseErrors.unexpectedError(interaction, err))
                .catch(() =>
                    failedInteractions.push({
                        username: interaction.user.username,
                        interaction: interaction
                    })
                );
        });
        return;
    }
    if (!interaction.inCachedGuild() || !interaction.inGuild()) {
        // required check to make sure all the types are safe
        interaction.isRepliable() &&
            (await interaction.reply(
                SimpleEmbed('I can only accept server based interactions.')
            ));
        return;
    }
    dispatchServerInteractions(interaction).catch((err: Error) => {
        interaction.user
            .send(UnexpectedParseErrors.unexpectedError(interaction, err))
            .catch(() => {
                failedInteractions.push({
                    username: interaction.user.username,
                    interaction: interaction
                });
            });
    });
    if (failedInteractions.length >= 5) {
        console.error(`These ${failedInteractions.length} interactions failed: `);
        console.error(failedInteractions);
        failedInteractions.splice(0, failedInteractions.length);
    }
});

/**
 * Gives the Student role to new members
 */
client.on('guildMemberAdd', async member => {
    const server =
        attendingServers.get(member.guild.id) ?? (await joinGuild(member.guild));
    const studentRole = server.guild.roles.cache.find(
        role => role.id === server.studentRoleID
    );
    if (
        studentRole !== undefined &&
        !member.user.bot &&
        studentRole.id !== server.guild.roles.everyone.id
    ) {
        await member.roles.add(studentRole);
    }
});

/**
 * Used for inviting YABOB to a server with existing roles
 * Once YABOB has the highest role, start the initialization call
 */
client.on('roleUpdate', async role => {
    if (attendingServers.has(role.guild.id)) {
        return;
    }
    if (
        role.name === client.user.username &&
        role.guild.roles.highest.name === client.user.username
    ) {
        console.log(cyan('Got the highest Role! Starting server initialization'));
        const owner = await role.guild.fetchOwner();
        const [server] = await Promise.all([
            joinGuild(role.guild),
            owner.send(
                SimpleEmbed(
                    `Got the highest Role!` +
                        ` Starting server initialization for ${role.guild.name}`,
                    EmbedColor.Success
                )
            )
        ]);
        await owner.send(serverRolesConfigMenu(server, owner.id, true, true));
    }
});

/**
 * Track when members join or leave a voice channel
 */
client.on('voiceStateUpdate', async (oldVoiceState, newVoiceState) => {
    if (newVoiceState.member === null) {
        throw new Error('Received VC event in a server without initialized YABOB.');
    }
    const serverId = oldVoiceState.guild.id;
    if (isLeaveVC(oldVoiceState, newVoiceState)) {
        await attendingServers
            .get(serverId)
            ?.onMemberLeaveVC(newVoiceState.member, oldVoiceState);
    } else if (isJoinVC(oldVoiceState, newVoiceState)) {
        await attendingServers
            .get(serverId)
            ?.onMemberJoinVC(newVoiceState.member, newVoiceState);
    }
});

client.on('roleDelete', async role => {
    const server = attendingServers.get(role.guild.id);
    if (server !== undefined) {
        await server.onRoleDelete(role);
    }
});

/**
 * Discord.js warning handling
 */
client.on('warn', warning => {
    console.warn(magenta('Uncaught DiscordJS Warning: '), warning);
});

/**
 * Neatly separate server log and error stack trace
 */
process.on('exit', () => {
    console.log(centered('-------- End of Server Log --------'));
    console.log(`${centered('-------- Begin Error Stack Trace --------')}\n`);
    console.log(`These ${failedInteractions.length} interactions failed:`);
    console.log(failedInteractions);
});

/**
 * YABOB Initilization sequence
 * @param guild server to join
 * @returns AttendingServerV2 if successfully initialized
 * @throws ServerError if the AttendingServerV2.create failed
 */
async function joinGuild(guild: Guild): Promise<AttendingServerV2> {
    console.log(`Joining guild: ${yellow(guild.name)}`);
    if (!environment.disableExtensions) {
        interactionExtensions.set(
            guild.id,
            await Promise.all([CalendarInteractionExtension.load(guild)])
        );
    }
    // Extensions for server&queue are loaded inside the create method
    const server = await AttendingServerV2.create(guild);
    attendingServers.set(guild.id, server);
    await postSlashCommands(
        guild,
        interactionExtensions.get(guild.id)?.flatMap(ext => ext.slashCommandData)
    );
    return server;
}

/**
 * Dispatches the ineraction to different handlers.
 * @remark This is for dm interactions only. See {@link dispatchServerInteractions}
 * for the server interaction dispatcher
 * @param interaction must be DM based
 * @returns boolean, whether the command was handled
 */
async function dispatchDMInteraction(interaction: Interaction): Promise<boolean> {
    if (interaction.isButton()) {
        if (builtInDMButtonHandlerCanHandle(interaction)) {
            await processBuiltInDMButton(interaction);
            return true;
        } else {
            const externalDMButtonHandler = interactionExtensions
                .get(interaction.customId)
                ?.find(ext => ext.canHandleDMButton(interaction));
            await externalDMButtonHandler?.processDMButton(interaction);
            return externalDMButtonHandler !== undefined;
        }
    } else if (interaction.isModalSubmit()) {
        if (builtInDMModalHandlerCanHandle(interaction)) {
            await processBuiltInDMModalSubmit(interaction);
            return true;
        } else {
            const externalDMModalHandler = interactionExtensions
                .get(interaction.customId)
                ?.find(ext => ext.canHandleDMModalSubmit(interaction));
            await externalDMModalHandler?.processDMModalSubmit(interaction);
            return externalDMModalHandler !== undefined;
        }
    } else if (interaction.isSelectMenu()) {
        if (builtInDMSelectMenuHandlerCanHandle(interaction)) {
            await processBuiltInDMSelectMenu(interaction);
            return true;
        } else {
            const externalDMSelectMenuHandler = interactionExtensions
                .get(interaction.customId)
                ?.find(ext => ext.canHandleDMSelectMenu(interaction));
            await externalDMSelectMenuHandler?.processDMSelectMenu(interaction);
            return externalDMSelectMenuHandler !== undefined;
        }
    } else {
        interaction.isRepliable() &&
            (await interaction.reply(
                SimpleEmbed('I can not process this DM interaction.')
            ));
        return false;
    }
}

/**
 * Dispatches the interaction to different handlers.
 * @remark This is for server interactions only. See {@link dispatchDMInteraction}
 * for the dm interaction dispatcher
 * @param interaction must be server based
 * @returns boolean, whether the command was handled
 */
async function dispatchServerInteractions(
    interaction: Interaction<'cached'>
): Promise<boolean> {
    // if it's a built-in command/button, process
    // otherwise find an extension that can process it
    if (interaction.isChatInputCommand()) {
        if (builtInCommandHandlerCanHandle(interaction)) {
            await processBuiltInCommand(interaction);
            return true;
        } else {
            const externalCommandHandler = interactionExtensions
                // default value is for semantics only
                .get(interaction.guildId)
                ?.find(ext => ext.canHandleCommand(interaction));
            await externalCommandHandler?.processCommand(interaction);
            return externalCommandHandler !== undefined;
        }
    } else if (interaction.isButton()) {
        if (builtInButtonHandlerCanHandle(interaction)) {
            await processBuiltInButton(interaction);
            return true;
        } else {
            const externalButtonHandler = interactionExtensions
                .get(interaction.guildId)
                ?.find(ext => ext.canHandleButton(interaction));
            await externalButtonHandler?.processButton(interaction);
            return externalButtonHandler !== undefined;
        }
    } else if (interaction.isModalSubmit()) {
        if (builtInModalHandlerCanHandle(interaction)) {
            await processBuiltInModalSubmit(interaction);
            return true;
        } else {
            const externalModalHandler = interactionExtensions
                .get(interaction.guildId)
                ?.find(ext => ext.canHandleModalSubmit(interaction));
            await externalModalHandler?.processModalSubmit(interaction);
            return externalModalHandler !== undefined;
        }
    } else if (interaction.isSelectMenu()) {
        if (builtInSelectMenuHandlerCanHandle(interaction)) {
            await processBuiltInSelectMenu(interaction);
            return true;
        } else {
            const externalSelectMenuHandler = interactionExtensions
                .get(interaction.guildId)
                ?.find(ext => ext.canHandleSelectMenu(interaction));
            await externalSelectMenuHandler?.processSelectMenu(interaction);
            return externalSelectMenuHandler !== undefined;
        }
    }
    return false;
}
