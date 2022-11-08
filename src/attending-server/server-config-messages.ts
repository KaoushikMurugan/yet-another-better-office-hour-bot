import {
    ActionRowBuilder,
    BaseMessageOptions,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { SimpleEmbed, EmbedColor } from '../utils/embed-helper.js';
import {
    generateDMYabobButtonId,
    generateOtherYabobButtonId,
    yabobButtonToString
} from '../utils/util-functions.js';
import { AttendingServerV2 } from './base-attending-server.js';

const ServerConfig = {
    serverRolesConfigMenu(
        server: AttendingServerV2,
        forServerInit: boolean,
        channelId: string,
        isDm: boolean
    ): BaseMessageOptions {
        const botAdminRole = server.botAdminRoleID;
        const helperRole = server.helperRoleID;
        const studentRole = server.studentRoleID;

        const embed = SimpleEmbed(
            `Server Configuration for ${server.guild.name}`,
            EmbedColor.Aqua,
            (forServerInit
                ? `Thanks for choosing YABOB for helping you with office hours!\n To start using YABOB, it requires the following roles: \n\n`
                : `The server roles configuration is as follows:\n\n`) +
                `**Bot Admin Role:** ${
                    forServerInit
                        ? ` Role that can manage the bot and it's settings\n`
                        : botAdminRole !== 'Not Set'
                        ? `<@&${botAdminRole}>`
                        : 'Not Set'
                }\n` +
                `**Helper Role:** ${
                    forServerInit
                        ? ` Role that allows users to host office hours\n`
                        : helperRole !== 'Not Set'
                        ? `<@&${helperRole}>`
                        : 'Not Set'
                }\n` +
                `**Student Role:** ${
                    forServerInit
                        ? ` Role that allows users to join office hour queues\n`
                        : studentRole !== 'Not Set'
                        ? `<@&${studentRole}>`
                        : 'Not Set'
                }\n\n` +
                `Select an option below to change the configuration.\n\n` +
                `**1** - Use existing roles named the same as the missing roles. If not found create new roles\n` +
                `**⤷a** - Use the @everyone role for the Student role if missing\n` +
                `**2** - Create brand new roles for the missing roles\n` +
                `**⤷a** - Use the @everyone role for the Student role if missing\n` +
                `If you want to set the roles manually, use the \`/set_roles\` command.`
        );

        function composeSSRCButtonId(optionNumber: string): string {
            let newYabobButton;
            if (isDm) {
                newYabobButton = generateDMYabobButtonId(
                    `ssrc${optionNumber}`,
                    server.guild.id,
                    channelId
                );
            } else {
                newYabobButton = generateOtherYabobButtonId(
                    `ssrc${optionNumber}`,
                    server.guild.id,
                    channelId
                );
            }
            return yabobButtonToString(newYabobButton);
        }

        // ssrc = setup_server_roles_config_. shortened due to limited customId length

        const buttons = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(composeSSRCButtonId('1'))
                    .setLabel('1')
                    .setStyle(ButtonStyle.Secondary)
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(composeSSRCButtonId('1a'))
                    .setLabel('1A')
                    .setStyle(ButtonStyle.Secondary)
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(composeSSRCButtonId('2'))
                    .setLabel('2')
                    .setStyle(ButtonStyle.Secondary)
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(composeSSRCButtonId('2a'))
                    .setLabel('2A')
                    .setStyle(ButtonStyle.Secondary)
            );

        return { embeds: embed.embeds, components: [buttons] };
    }
};

export { ServerConfig as serverConfig };
