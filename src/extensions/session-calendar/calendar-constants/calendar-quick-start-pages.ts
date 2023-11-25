import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { AttendingServer } from '../../../attending-server/base-attending-server.js';
import { QuickStartPageFunctions, YabobEmbed } from '../../../utils/type-aliases.js';
import { buildComponent } from '../../../utils/component-id-factory.js';
import {
    generatePageNumber,
    NavigationRow
} from '../../../attending-server/quick-start-pages.js';

function TestCalQS(server: AttendingServer, updateMessage = ''): YabobEmbed {
    const embed = new EmbedBuilder()
        .setTitle(server.guild.name)
        .setDescription('bruh')
        .setFooter({
            text:
                `${generatePageNumber(TestCalQS)}` +
                (updateMessage.length > 0 ? ` • ✅ ${updateMessage}` : '')
        });
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buildComponent(new ButtonBuilder(), ['other', 'unused', server.guild.id])
            .setEmoji('🔵')
            .setLabel('BTN1')
            .setStyle(ButtonStyle.Secondary),
        buildComponent(new ButtonBuilder(), ['other', 'unused2', server.guild.id])
            .setEmoji('🔵')
            .setLabel('BTN2')
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        embeds: [embed],
        components: [buttons, NavigationRow(server.guild.id)]
    };
}

const quickStartPages: readonly QuickStartPageFunctions[] = [TestCalQS];

export { quickStartPages };
