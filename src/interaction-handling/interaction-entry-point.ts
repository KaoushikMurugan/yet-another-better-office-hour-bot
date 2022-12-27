import { Interaction } from 'discord.js';
import {
    ButtonHandlerProps,
    CommandHandlerProps,
    ModalSubmitHandlerProps,
    SelectMenuHandlerProps
} from './handler-interface.js';
import {
    ButtonLogEmbed,
    ErrorEmbed,
    ErrorLogEmbed,
    SimpleEmbed,
    SlashCommandLogEmbed
} from '../utils/embed-helper.js';
import { isServerInteraction } from '../command-handling/common-validations.js';
import {
    UnknownId,
    decompressComponentId,
    extractComponentName
} from '../utils/component-id-factory.js';
import { logDMButtonPress } from '../utils/util-functions.js';

const testCommandMap: CommandHandlerProps = {
    regularCommands: {},
    requireFirstResponseCommands: {}
};

const testButtonMap: ButtonHandlerProps = {
    queueButtons: {},
    regularButtons: {},
    requireFirstResponseButtons: {},
    updateParentInteractionButtons: {},
    dmButtons: {}
};

const testModalMap: ModalSubmitHandlerProps = {
    regularModals: {},
    updateParentInteractionModals: {},
    dmModals: {}
};

const testSelectMenuMap: SelectMenuHandlerProps = {
    regularSelectMenus: {},
    requireFirstResponseSelectMenus: {},
    updateParentInteractionSelectMenus: {},
    dmSelectMenus: {}
};

/**
 * All the processors are using the double dispatch pattern
 * allows the {@link getHandler} function to act like a function factory
 */

/**
 * Process ChatInputCommandInteractions
 * @param interaction
 * @returns
 */
async function processChatInputCommand(interaction: Interaction): Promise<void> {
    if (!interaction.inCachedGuild() || !interaction.isChatInputCommand()) {
        return; // do nothing if the interaction is not chat input command
    }
    const commandName = interaction.commandName;
    const server = isServerInteraction(interaction);
    if (commandName in testCommandMap.requireFirstResponseCommands) {
        await testCommandMap.requireFirstResponseCommands[commandName]?.(interaction);
        return;
    }
    await interaction.reply({ ...SimpleEmbed('Processing...'), ephemeral: true });
    await testCommandMap.regularCommands[commandName]?.(interaction)
        .then(async successMessage => {
            await interaction.editReply(successMessage);
            server.sendLogMessage(SlashCommandLogEmbed(interaction));
        })
        .catch(async err => {
            await interaction.editReply(ErrorEmbed(err));
            server.sendLogMessage(ErrorLogEmbed(err, interaction));
        });
}

async function processModalSubmit(interaction: Interaction): Promise<void> {
    if (!interaction.isModalSubmit() || !interaction.inCachedGuild()) {
        return;
    }
    const modalName = extractComponentName(interaction.customId);
    const server = isServerInteraction(interaction);
    if (modalName in testModalMap.updateParentInteractionModals) {
        await testModalMap.updateParentInteractionModals[modalName]?.(interaction);
    }
    await testModalMap.regularModals[modalName]?.(interaction)
        .then(async successMessage => {
            await interaction.reply({
                ...successMessage,
                ephemeral: true
            });
        })
        .catch(async err => {
            await interaction.reply({
                ...ErrorEmbed(err, server.botAdminRoleID),
                ephemeral: true
            });
            server.sendLogMessage(ErrorLogEmbed(err, interaction));
        });
}

async function processButton(interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) {
        return;
    }
    const [type, buttonName, serverId, channelId] = decompressComponentId(
        interaction.customId
    );
    const server = serverId !== UnknownId ? isServerInteraction(serverId) : undefined;
    const queueName =
        type === 'queue'
            ? interaction.guild?.channels.cache.get(channelId)?.parent?.name
            : undefined;
}

async function processSelectMenu(interaction: Interaction): Promise<void> {
    return;
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
