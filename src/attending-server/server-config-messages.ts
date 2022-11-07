import {
    ActionRowBuilder,
    BaseMessageOptions,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { SimpleEmbed, EmbedColor } from '../utils/embed-helper.js';
import { AttendingServerV2 } from './base-attending-server.js';

const ServerConfig = {
    serverRolesConfigMenu(server: AttendingServerV2): BaseMessageOptions {
        const botAdminRole = server.botAdminRoleID;
        const helperRole = server.helperRoleID;
        const studentRole = server.studentRoleID;

        const embed = SimpleEmbed(
            'Server Configuration',
            EmbedColor.Aqua,
            `The server roles configuration is as follows:\n\n` +
                `**Bot Admin Role:** ${
                    botAdminRole !== 'Not Set' ? `<@&${botAdminRole}>` : 'Not Set'
                }\n` +
                `**Helper Role:** ${
                    helperRole !== 'Not Set' ? `<@&${helperRole}>` : 'Not Set'
                }\n` +
                `**Student Role:** ${
                    studentRole !== 'Not Set' ? `<@&${studentRole}>` : 'Not Set'
                }\n\n` +
                `Select an option below to change the configuration.\n\n` +
                `**1** - Use existing roles named the same as the missing roles. If not found create new roles\n` +
                `**⤷a** - Use the @everyone role for the Student role if missing\n` +
                `**2** - Create brand new roles for the missing roles\n` +
                `**⤷a** - Use the @everyone role for the Student role if missing\n` +
                `If you want to set the roles manually, use the \`/set_roles\` command.`
        );

        const buttons = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('setup_server_roles_config_1')
                    .setLabel('1')
                    .setStyle(ButtonStyle.Secondary)
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('setup_server_roles_config_1a')
                    .setLabel('1A')
                    .setStyle(ButtonStyle.Secondary)
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('setup_server_roles_config_2')
                    .setLabel('2')
                    .setStyle(ButtonStyle.Secondary)
            )
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('setup_server_roles_config_2a')
                    .setLabel('2A')
                    .setStyle(ButtonStyle.Secondary)
            );

        return { embeds: embed.embeds, components: [buttons] };
    }
};

export { ServerConfig as serverConfig };
