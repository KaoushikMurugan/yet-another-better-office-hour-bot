import { Interaction, TextChannel } from 'discord.js';
import {
    ButtonHandlerProps,
    CommandHandlerProps,
    ModalSubmitHandlerProps,
    SelectMenuHandlerProps
} from './handler-interface.js';
import {
    ButtonLogEmbed,
    ErrorEmbed,
    SelectMenuLogEmbed,
    SimpleEmbed
} from '../utils/embed-helper.js';
import { isServerInteraction } from '../command-handling/common-validations.js';
import { decompressComponentId } from '../utils/component-id-factory.js';
import {
    logButtonPress,
    logDMButtonPress,
    logDMModalSubmit,
    logDMSelectMenuSelection,
    logModalSubmit,
    logSelectMenuSelection,
    logSlashCommand
} from '../utils/util-functions.js';
import { baseYabobButtonMethodMap } from './button-handler.js';
import { baseYabobCommandMap } from './command-handler.js';
import { baseYabobSelectMenuMap } from './select-menu-handler.js';
import { baseYabobModalMap } from './modal-handler.js';

/**
 * All the processors are using the double dispatch pattern
 * allows the {@link getHandler} function to act like a function factory
 */

const completeCommandMap: CommandHandlerProps = { ...baseYabobCommandMap };
const completeButtonMap: ButtonHandlerProps = { ...baseYabobButtonMethodMap };
const completeSelectMenuMap: SelectMenuHandlerProps = { ...baseYabobSelectMenuMap };
const completeModalMap: ModalSubmitHandlerProps = { ...baseYabobModalMap };

/**
 * Process ChatInputCommandInteractions
 * @param interaction
 */
async function processChatInputCommand(interaction: Interaction): Promise<void> {
    const props = completeCommandMap; // TODO: Remove this
    if (!interaction.inCachedGuild() || !interaction.isChatInputCommand()) {
        return;
    }
    const commandName = interaction.commandName;
    const handleCommand = props.methodMap[commandName];
    const server = isServerInteraction(interaction);
    logSlashCommand(interaction);
    if (!props.skipProgressMessageCommands.has(commandName)) {
        await interaction.reply({
            ...SimpleEmbed(`Processing command \`${commandName}\``),
            ephemeral: true
        });
    }
    await handleCommand?.(interaction).catch(async (err: Error) => {
        await interaction.editReply(ErrorEmbed(err, server.botAdminRoleID));
    });
}

/**
 * Process ButtonInteractions
 * @param interaction
 */
async function processButton(interaction: Interaction): Promise<void> {
    const props = completeButtonMap;
    if (!interaction.isButton()) {
        return;
    }
    const [type, buttonName, serverId] = decompressComponentId(interaction.customId);
    const server = isServerInteraction(interaction.guildId ?? serverId); // serverId might be unknown
    server.sendLogMessage(
        ButtonLogEmbed(interaction.user, buttonName, interaction.channel as TextChannel)
    );
    if (!props.skipProgressMessageButtons.has(buttonName)) {
        await interaction.reply({
            ...SimpleEmbed(`Processing button \`${buttonName}\`...`),
            ephemeral: true
        });
    }
    if (interaction.inCachedGuild() && type !== 'dm') {
        const handleModalSubmit = props.guildMethodMap[type][buttonName];
        await handleModalSubmit?.(interaction).catch(async (err: Error) => {
            await interaction.editReply(ErrorEmbed(err, server.botAdminRoleID));
        });
        logButtonPress(interaction, buttonName);
    } else {
        const handleModalSubmit = props.dmMethodMap[buttonName];
        await handleModalSubmit?.(interaction).catch(async (err: Error) => {
            await interaction.editReply(ErrorEmbed(err, server.botAdminRoleID));
        });
        logDMButtonPress(interaction, buttonName);
    }
}

/**
 * Process SelectMenuInteractions
 * @param interaction
 */
async function processSelectMenu(interaction: Interaction): Promise<void> {
    const props = completeSelectMenuMap;
    if (!interaction.isSelectMenu()) {
        return;
    }
    const [type, selectMenuName, serverId] = decompressComponentId(interaction.customId);
    const server = isServerInteraction(interaction.guildId ?? serverId);
    server.sendLogMessage(
        SelectMenuLogEmbed(
            interaction.user,
            selectMenuName,
            interaction.values,
            interaction.channel as TextChannel
        )
    );
    if (!props.skipProgressMessageSelectMenus.has(selectMenuName)) {
        await interaction.reply({
            ...SimpleEmbed(`Processing button \`${selectMenuName}\``),
            ephemeral: true
        });
    }
    if (interaction.inCachedGuild() && type !== 'dm') {
        const handleModalSubmit = props.guildMethodMap[type][selectMenuName];
        await handleModalSubmit?.(interaction).catch(async (err: Error) => {
            await interaction.editReply(ErrorEmbed(err, server.botAdminRoleID));
        });
        logSelectMenuSelection(interaction, selectMenuName);
    } else {
        const handleModalSubmit = props.dmMethodMap[selectMenuName];
        await handleModalSubmit?.(interaction).catch(async (err: Error) => {
            await interaction.editReply(ErrorEmbed(err, server.botAdminRoleID));
        });
        logDMSelectMenuSelection(interaction, selectMenuName);
    }
}

/**
 * Process ModalSubmitInteractions
 * @param interaction
 */
async function processModalSubmit(interaction: Interaction): Promise<void> {
    const props = completeModalMap;
    if (!interaction.isModalSubmit()) {
        return;
    }
    const [type, modalName, serverId] = decompressComponentId(interaction.customId);
    const server = isServerInteraction(interaction.guildId ?? serverId);
    server.sendLogMessage(
        ButtonLogEmbed(interaction.user, modalName, interaction.channel as TextChannel)
    );
    if (interaction.inCachedGuild() && type !== 'dm') {
        const handleModalSubmit = props.guildMethodMap[type][modalName];
        await handleModalSubmit?.(interaction).catch(async (err: Error) => {
            await interaction.editReply(ErrorEmbed(err, server.botAdminRoleID));
        });
        logModalSubmit(interaction, modalName);
    } else {
        const handleModalSubmit = props.dmMethodMap[modalName];
        await handleModalSubmit?.(interaction).catch(async (err: Error) => {
            await interaction.editReply(ErrorEmbed(err, server.botAdminRoleID));
        });
        logDMModalSubmit(interaction, modalName);
    }
}

/**
 * Fallback handler for unsupported interactions
 * @param interaction unsupported interaction
 */
async function unsupportedInteraction(interaction: Interaction): Promise<void> {
    if (interaction.isRepliable()) {
        await interaction.reply(
            SimpleEmbed('This interaction is currently not supported')
        );
    }
}

/**
 * Higer order function that abstracts away all the condictionals needed to find the correct handler
 * - getHandler and all the processors use the double dispatch pattern
 * @param interaction
 * @returns the handler function that can be invoked with any interaction
 */
function getHandler(interaction: Interaction): (i: Interaction) => Promise<void> {
    if (interaction.isChatInputCommand()) {
        return processChatInputCommand;
    }
    if (interaction.isModalSubmit()) {
        return processModalSubmit;
    }
    if (interaction.isSelectMenu()) {
        return processSelectMenu;
    }
    if (interaction.isButton()) {
        return processButton;
    }
    return unsupportedInteraction;
}

export { getHandler };
