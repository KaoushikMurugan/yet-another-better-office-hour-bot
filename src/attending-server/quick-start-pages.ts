import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    Snowflake
} from 'discord.js';
import {
    QuickStartPageFunctions,
    SpecialRoleValues,
    YabobEmbed
} from '../utils/type-aliases.js';
import { UnknownId, buildComponent } from '../utils/component-id-factory.js';
import {
    ButtonNames,
    CommandNames
} from '../interaction-handling/interaction-constants/interaction-names.js';
import { EmbedColor } from '../utils/embed-helper.js';
import { AttendingServerV2 } from './base-attending-server.js';
import { documentationLinks } from '../utils/documentation-helper.js';

const QuickStartPages: QuickStartPageFunctions[] = [
    QuickStartFirstPage,
    QuickStartSetRoles,
    QuickStartCreateAQueue,
    QuickStartLastPage
];

function generatePageNumber(functionName: QuickStartPageFunctions): string {
    return `Page ${
        QuickStartPages.findIndex(pageFunction => {
            return pageFunction === functionName;
        }) + 1
    }/${QuickStartPages.length}`;
}

function QuickStartFirstPage(): YabobEmbed {
    const embed = new EmbedBuilder()
        .setTitle('Quick Start')
        .setDescription(
            'Welcome to YABOB! This is a quick start guide to get you started with the bot. If you have any questions, please ask in the support server.' +
                '\n\nUse the **Next** button to go to the next page, and the **Back** button to go to the previous page. ' +
                'Use the **Skip** button to skip a page. '
        )
        .setFooter({
            text: generatePageNumber(QuickStartFirstPage)
        });

    const quickStartButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        quickStartBackButton(false),
        quickStartNextButton(true),
        quickStartSkipButton(false)
    );

    return {
        embeds: [embed],
        components: [quickStartButtons]
    };
}

function QuickStartSetRoles(
    server: AttendingServerV2,
    channelId: string,
    updateMessage = ''
): YabobEmbed {
    const generatePing = (id: Snowflake | SpecialRoleValues) => {
        return id === SpecialRoleValues.NotSet
            ? 'Not Set'
            : id === SpecialRoleValues.Deleted
            ? '@deleted-role'
            : `<@&${id}>`;
    };
    const setRolesCommandId = server.guild.commands.cache.find(
        command => command.name === CommandNames.set_roles
    )?.id;
    const embed = new EmbedBuilder()
        .setTitle(`Quick Start: Set Roles`)
        .setColor(EmbedColor.Aqua)
        .setFooter({
            text: `${generatePageNumber(QuickStartSetRoles)}` + ((updateMessage.length > 0) ? ` ● ✅ ${updateMessage}` : '')
        })
        .addFields(
            {
                name: 'Description',
                value:
                    'YABOB requires three roles to function properly: Bot Admin, Staff, and Student. These roles are used to control access to the bot and its commands.' +
                    '\n\nStudent only have acces to joining/leaving queues and viewing schedules, Helpers can host sessions, and Bot Admins can configure the bot.' +
                    '\n\nYou can use the buttons below to create new roles, or use existing roles. If you use existing roles, make sure they have the correct permissions.' +
                    `\n\nIf you'd like more granular control over roles, use the </set_roles:${setRolesCommandId}> command.`
            },
            {
                name: 'Documentation',
                value: `[Learn more about YABOB roles here.](${documentationLinks.serverRoles})`
            },
            {
                name: 'Warning',
                value: 'If roles named Bot Admin, Staff, or Student already exist, duplicate roles will be created when using [Create new Roles].'
            },
            {
                name: '┈'.repeat(25),
                value: '**Current Role Configuration**'
            },
            {
                name: '🤖 Bot Admin Role',
                value: generatePing(server.botAdminRoleID),
                inline: true
            },
            {
                name: '📚 Staff Role',
                value: generatePing(server.staffRoleID),
                inline: true
            },
            {
                name: ' 🎓 Student Role',
                value: generatePing(server.studentRoleID),
                inline: true
            }
        );
    const buttons = [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            buildComponent(new ButtonBuilder(), [
                'other',
                ButtonNames.ServerRoleConfig1QS,
                server.guild.id,
                channelId
            ])
                // this emoji string must be free of any other characters
                // otherwise it will throw a InteractionNotReplied Error, and discord js doesn't validate this
                .setEmoji('🔵')
                .setLabel('Use Existing Roles')
                .setStyle(ButtonStyle.Secondary),
            buildComponent(new ButtonBuilder(), [
                'other',
                ButtonNames.ServerRoleConfig1aQS,
                server.guild.id,
                channelId
            ])
                .setEmoji('🔵')
                .setLabel('Use Existing Roles (@everyone is student)')
                .setStyle(ButtonStyle.Secondary)
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            buildComponent(new ButtonBuilder(), [
                'other',
                ButtonNames.ServerRoleConfig2QS,
                server.guild.id,
                channelId
            ])
                .setEmoji('🟠')
                .setLabel('Create New Roles')
                .setStyle(ButtonStyle.Secondary),
            buildComponent(new ButtonBuilder(), [
                'other',
                ButtonNames.ServerRoleConfig2aQS,
                server.guild.id,
                channelId
            ])
                .setEmoji('🟠')
                .setLabel('Create New Roles (@everyone is student)')
                .setStyle(ButtonStyle.Secondary)
        )
    ];

    const allowSkip =
        server.botAdminRoleID === SpecialRoleValues.NotSet ||
        server.staffRoleID === SpecialRoleValues.NotSet ||
        server.studentRoleID === SpecialRoleValues.NotSet;

    const quickStartButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        quickStartBackButton(true),
        quickStartNextButton(!allowSkip),
        quickStartSkipButton(allowSkip)
    );

    return {
        embeds: [embed.data],
        components: [quickStartButtons, ...buttons]
    };
}

function QuickStartCreateAQueue(server: AttendingServerV2): YabobEmbed {
    // get the queue add command id
    const queueAddCommandId = server.guild.commands.cache.find(
        command =>
            command.name === CommandNames.queue && command.options[0]?.name === 'add'
    )?.id;

    const embed = new EmbedBuilder()
        .setTitle('Quick Start - Create a Queue')
        .setDescription(
            'Now that you have set up your server roles, try creating a queue!' +
                `\n\nUse the </queue add:${queueAddCommandId}> command to create a queue. Enter the name of the queue, e.g. \`Office Hours\`` +
                `\n\nAfter entering the command you should be able to see a new category created on the server with the name you entered, under it will be a \`#chat\` channel and \`#queue\` channel` +
                '\n\nUse the **Next** button to go to the next page, and the **Back** button to go to the previous page. ' +
                'Use the **Skip** button to skip a page.'
        )
        .setFooter({
            text: generatePageNumber(QuickStartCreateAQueue)
        });

    const quickStartButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        quickStartBackButton(true),
        quickStartNextButton(true),
        quickStartSkipButton(false)
    );

    return {
        embeds: [embed],
        components: [quickStartButtons]
    };
}

function QuickStartLastPage(): YabobEmbed {
    const embed = new EmbedBuilder()
        .setTitle('Quick Start - Finished!')
        .setDescription(
            'Congratulations! You have completed the quick start guide. If you have any questions, please ask in the support server. ' +
                'Use the **Back** button to go to the previous page. Press the blue `dismiss message` text below the buttons to close this message.'
        )
        .setFooter({
            text: generatePageNumber(QuickStartLastPage)
        });

    const quickStartButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        quickStartBackButton(true),
        quickStartNextButton(false),
        quickStartSkipButton(false)
    );

    return {
        embeds: [embed],
        components: [quickStartButtons]
    };
}

function quickStartBackButton(enable: boolean): ButtonBuilder {
    return buildComponent(new ButtonBuilder(), [
        'other',
        ButtonNames.QuickStartBack,
        UnknownId,
        UnknownId
    ])
        .setEmoji('⬅️')
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!enable);
}

function quickStartNextButton(enable: boolean): ButtonBuilder {
    return buildComponent(new ButtonBuilder(), [
        'other',
        ButtonNames.QuickStartNext,
        UnknownId,
        UnknownId
    ])
        .setEmoji('➡️')
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!enable);
}

function quickStartSkipButton(enable: boolean): ButtonBuilder {
    return buildComponent(new ButtonBuilder(), [
        'other',
        ButtonNames.QuickStartSkip,
        UnknownId,
        UnknownId
    ])
        .setEmoji('⏭️')
        .setLabel('Skip')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!enable);
}

export { QuickStartPages, QuickStartFirstPage, QuickStartSetRoles, QuickStartCreateAQueue, QuickStartLastPage };
