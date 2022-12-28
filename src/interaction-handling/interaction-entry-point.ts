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
    SimpleEmbed,
    SimpleEmbed2
} from '../utils/embed-helper.js';
import { isServerInteraction } from '../command-handling/common-validations.js';
import { decompressComponentId } from '../utils/component-id-factory.js';

/**
 * All the processors are using the double dispatch pattern
 * allows the {@link getHandler} function to act like a function factory
 */

const testCommandMap: CommandHandlerProps = {
    methodMap: {},
    skipProgressMessageCommands: new Set()
};

const testButtonMap: ButtonHandlerProps = {
    guildMethodMap: {
        queue: {},
        other: {}
    },
    dmMethodMap: {},
    skipProgressMessageButtons: new Set()
};

const testSelectMenuMap: SelectMenuHandlerProps = {
    guildMethodMap: {
        queue: {},
        other: {}
    },
    dmMethodMap: {},
    skipProgressMessageSelectMenus: new Set()
};

const testModalMap: ModalSubmitHandlerProps = {
    guildMethodMap: {
        queue: {},
        other: {}
    },
    dmMethodMap: {},
    skipProgressMessageModals: new Set()
};

/**
 * Process ChatInputCommandInteractions
 * @param interaction
 */
async function processChatInputCommand(interaction: Interaction): Promise<void> {
    const props = testCommandMap; // TODO: Remove this
    if (!interaction.inCachedGuild() || !interaction.isChatInputCommand()) {
        return;
    }
    const commandName = interaction.commandName;
    const handleCommand = props.methodMap[commandName];
    const server = isServerInteraction(interaction);
    if (!props.skipProgressMessageCommands.has(commandName)) {
        await interaction.reply({
            ...SimpleEmbed2(`Processing command \`${commandName}\``).data,
            ephemeral: true
        });
    }
    await handleCommand?.(interaction).catch(async (err: Error) => {
        await interaction.editReply(ErrorEmbed(err, server.botAdminRoleID));
    });
}

/**
 * Process ModalSubmitInteractions
 * @param interaction
 */
async function processModalSubmit(interaction: Interaction): Promise<void> {
    const props = testModalMap;
    if (!interaction.isModalSubmit()) {
        return;
    }
    const [type, modalName, serverId] = decompressComponentId(interaction.customId);
    const server = isServerInteraction(serverId);
    if (interaction.inCachedGuild() && type !== 'dm') {
        const handleModalSubmit = props.guildMethodMap[type][modalName];
        await handleModalSubmit?.(interaction).catch(async (err: Error) => {
            await interaction.editReply(ErrorEmbed(err, server.botAdminRoleID));
        });
    } else {
        const handleModalSubmit = props.dmMethodMap[modalName];
        await handleModalSubmit?.(interaction).catch(async (err: Error) => {
            await interaction.editReply(ErrorEmbed(err, server.botAdminRoleID));
        });
    }
}

/**
 * Process ButtonInteractions
 * @param interaction
 */
async function processButton(interaction: Interaction): Promise<void> {
    const props = testButtonMap;
    if (!interaction.isButton()) {
        return;
    }
    const [type, buttonName, serverId] = decompressComponentId(interaction.customId);
    const server = isServerInteraction(serverId);
    server.sendLogMessage(
        ButtonLogEmbed(
            interaction.user,
            `Create Roles ${interaction.component?.label ?? ''}`,
            interaction.channel as TextChannel
        )
    );
    if (interaction.inCachedGuild() && type !== 'dm') {
        const handleModalSubmit = props.guildMethodMap[type][buttonName];
        await handleModalSubmit?.(interaction).catch(async (err: Error) => {
            await interaction.editReply(ErrorEmbed(err, server.botAdminRoleID));
        });
    } else {
        const handleModalSubmit = props.dmMethodMap[buttonName];
        await handleModalSubmit?.(interaction).catch(async (err: Error) => {
            await interaction.editReply(ErrorEmbed(err, server.botAdminRoleID));
        });
    }
}

/**
 * Process SelectMenuInteractions
 * @param interaction
 */
async function processSelectMenu(interaction: Interaction): Promise<void> {
    const props = testSelectMenuMap;
    if (!interaction.isSelectMenu()) {
        return;
    }
    const [type, selectMenuName, serverId] = decompressComponentId(interaction.customId);
    const server = isServerInteraction(serverId);
    server.sendLogMessage(
        SelectMenuLogEmbed(
            interaction.user,
            `Server Settings`,
            interaction.values,
            interaction.channel as TextChannel
        )
    );
    if (interaction.inCachedGuild() && type !== 'dm') {
        const handleModalSubmit = props.guildMethodMap[type][selectMenuName];
        await handleModalSubmit?.(interaction).catch(async (err: Error) => {
            await interaction.editReply(ErrorEmbed(err, server.botAdminRoleID));
        });
    } else {
        const handleModalSubmit = props.dmMethodMap[selectMenuName];
        await handleModalSubmit?.(interaction).catch(async (err: Error) => {
            await interaction.editReply(ErrorEmbed(err, server.botAdminRoleID));
        });
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
