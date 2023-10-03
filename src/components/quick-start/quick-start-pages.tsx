import {
    ActionRow,
    Button,
    Embed,
    EmbedField,
    EmbedFooter,
    EmbedTitle,
    useInstance,
    Select,
    Option
} from 'reacord';
import React, { useMemo, useState } from 'react';
import { EmbedColor } from '../../utils/embed-helper';
import {
    wikiBaseUrl,
    supportServerInviteLink,
    documentationLinks
} from '../../utils/documentation-helper';
import { Snowflake } from 'discord.js';
import { CommandNames } from '../../interaction-handling/interaction-constants/interaction-names';
import { SpecialRoleValues } from '../../utils/type-aliases';
import { AttendingServerV2 } from '../../attending-server/base-attending-server';
import { B, Br, InlineCode, MdLink } from '../helper-components';
import { isTextChannel, longestCommonSubsequence } from '../../utils/util-functions';

type PageIndex = 1 | 2 | 3 | 4 | 5 | 6;

type QuickStartPageProps = {
    serverId: Snowflake;
    currentPage: number;
    assignedIndex: number;
    setActionCompleted: React.Dispatch<
        React.SetStateAction<{ [K in PageIndex]: boolean }>
    >;
};

const NUM_PAGES = 6;

function generatePing(id: Snowflake | SpecialRoleValues): string {
    return id === SpecialRoleValues.NotSet
        ? 'Not Set'
        : id === SpecialRoleValues.Deleted
        ? '@deleted-role'
        : `<@&${id}>`;
}

function QuickStartRoot({ serverId }: { serverId: Snowflake }): JSX.Element {
    const instance = useInstance();
    const [page, setPage] = useState(1);
    const [actionCompleted, setActionCompleted] = useState<{ [K in PageIndex]: boolean }>(
        {
            1: true,
            2: !Object.keys(AttendingServerV2.get(serverId).accessLevelRoleIds).some(
                roleId => roleId in SpecialRoleValues
            ), // true if all role ids are actual snowflakes
            3: true,
            4: true,
            5: true,
            6: true
        }
    );
    const commonProps = {
        currentPage: page,
        serverId,
        setActionCompleted
    };
    return (
        <>
            <LandingPage {...commonProps} assignedIndex={1} />
            <SetRoles {...commonProps} assignedIndex={2} />
            <CreateQueue {...commonProps} assignedIndex={3} />
            <AutoGiveStudentRole {...commonProps} assignedIndex={4} />
            <LoggingChannel {...commonProps} assignedIndex={5} />
            <LastPage {...commonProps} assignedIndex={6} />

            <ActionRow>
                <Button
                    onClick={() => setPage(page - 1)}
                    label="Back"
                    disabled={page === 1}
                />
                <Button
                    onClick={() => setPage(page + 1)}
                    label="Next"
                    disabled={!actionCompleted[page as PageIndex] || page === NUM_PAGES}
                />
                {page === NUM_PAGES && (
                    <Button
                        label="Finish"
                        style="danger"
                        onClick={() => instance.destroy()}
                    />
                )}
            </ActionRow>
        </>
    );
}

function LandingPage({ currentPage, assignedIndex }: QuickStartPageProps): JSX.Element {
    if (currentPage !== assignedIndex) {
        return <></>;
    }
    return (
        <Embed color={EmbedColor.Aqua}>
            <EmbedTitle>Quick Start</EmbedTitle>
            <B>Welcome to YABOB!</B>
            <Br repeat={2} />
            This is a quick start guide to get you started with the bot.
            <Br repeat={2} />
            If you have any questions, check out{' '}
            <MdLink href={wikiBaseUrl}>the guide on github</MdLink> or{' '}
            <MdLink href={supportServerInviteLink}>
                join the support discord server
            </MdLink>
            ).
            <Br />
            Use the **Next** button to go to the next page, and the **Back** button to go
            to the previous page. Use the **Skip** button to skip a page.
            <EmbedFooter>
                Page {currentPage}/{NUM_PAGES}
            </EmbedFooter>
        </Embed>
    );
}

function SetRoles({
    serverId,
    currentPage,
    assignedIndex,
    setActionCompleted
}: QuickStartPageProps): JSX.Element {
    if (currentPage !== assignedIndex) {
        return <></>;
    }
    const server = AttendingServerV2.get(serverId);
    const setRolesCommandId = useMemo(
        () =>
            server.guild.commands.cache.find(
                command => command.name === CommandNames.set_roles
            )?.id,
        [serverId]
    );
    const complete = () =>
        setActionCompleted?.(prev => ({
            ...prev,
            [assignedIndex]: true
        }));

    return (
        <>
            <Embed color={EmbedColor.Aqua}>
                <EmbedTitle>Quick Start: Set Roles</EmbedTitle>

                <EmbedField name="Description">
                    YABOB requires three roles to function properly: <B>Bot Admin</B>,
                    <B>Staff</B>, and <B>Student</B>. These roles are used to control
                    access to the bot and its commands. For fresh servers, we recommend
                    using `Create New Roles`. If you would like more granular control over
                    roles, use the <B>{`</set_roles:${setRolesCommandId}> command.`}</B>
                </EmbedField>
                <EmbedField name="Documentation">
                    [Learn more about YABOB roles here.]({documentationLinks.serverRoles})
                </EmbedField>
                <EmbedField name="Warning">
                    If roles named Bot Admin, Staff, or Student already exist, duplicate
                    roles will be created when using [Create new Roles].
                </EmbedField>

                <EmbedField name={'┈'.repeat(25)}>
                    **Current Role Configuration**
                </EmbedField>

                <EmbedField name="🤖 Bot Admin Role" inline>
                    {generatePing(server.botAdminRoleID)}
                </EmbedField>
                <EmbedField name="📚 Staff Role" inline>
                    {generatePing(server.staffRoleID)}
                </EmbedField>
                <EmbedField name=" 🎓 Student Role" inline>
                    {generatePing(server.studentRoleID)}
                </EmbedField>

                <EmbedFooter>
                    Page {currentPage}/{NUM_PAGES}
                </EmbedFooter>
            </Embed>
            <ActionRow>
                <Button
                    onClick={() =>
                        server.createAccessLevelRoles(false, false).then(complete)
                    }
                    label="Use Existing Roles"
                    emoji="🔵"
                />
                <Button
                    onClick={() =>
                        server.createAccessLevelRoles(false, true).then(complete)
                    }
                    label="Use Existing Roles (@everyone is student)"
                    emoji="🔵"
                />
                <Button
                    onClick={() =>
                        server.createAccessLevelRoles(true, false).then(complete)
                    }
                    label="Create New Roles"
                    emoji="🟠"
                />
                <Button
                    onClick={() =>
                        server.createAccessLevelRoles(true, true).then(complete)
                    }
                    label="Create New Roles (@everyone is student)"
                    emoji="🟠"
                />
            </ActionRow>
        </>
    );
}

function CreateQueue({
    serverId,
    currentPage,
    assignedIndex
}: QuickStartPageProps): JSX.Element {
    if (currentPage !== assignedIndex) {
        return <></>;
    }
    const server = AttendingServerV2.get(serverId);
    const queueAddCommandId = useMemo(
        () =>
            server.guild.commands.cache.find(
                command =>
                    command.name === CommandNames.queue &&
                    command.options[0]?.name === 'add'
            )?.id,
        [serverId]
    );
    return (
        <Embed color={EmbedColor.Aqua}>
            <EmbedTitle>Quick Start: Create Queue</EmbedTitle>
            <B>Now that you have set up your server roles, try creating a queue!</B>
            <Br />
            Use the <B>{`</queue add:${queueAddCommandId}>`}</B> command to create a
            queue. Enter the name of the queue, e.g. <InlineCode>Office Hours</InlineCode>
            <Br />
            After entering the command you should be able to see a new category created on
            the server with the name you entered, under it will be a{' '}
            <InlineCode>#queue</InlineCode> channel and <InlineCode>#chat</InlineCode>{' '}
            channel
            <EmbedFooter>
                Page {currentPage}/{NUM_PAGES}
            </EmbedFooter>
        </Embed>
    );
}

function AutoGiveStudentRole({
    serverId,
    currentPage,
    assignedIndex,
    setActionCompleted
}: QuickStartPageProps) {
    if (currentPage !== assignedIndex) {
        return <></>;
    }

    const server = AttendingServerV2.get(serverId);
    const complete = () =>
        setActionCompleted?.(prev => ({
            ...prev,
            [assignedIndex]: true
        }));

    return (
        <>
            <Embed color={EmbedColor.Aqua}>
                <EmbedTitle>Quick Start - Auto Give Student Role</EmbedTitle>
                <EmbedField name="Description">
                    YABOB can automatically give the student (
                    {`<@&${server.studentRoleID}>`}) role to each new user that joins this
                    server.
                </EmbedField>
                <EmbedField name="Integration with other bots">
                    If you wish to use another bot to control the assignment of roles,
                    that's fine! It is only important that YABOB knows which roles are the
                    student, helper and bot admin roles.
                </EmbedField>
                <EmbedField name="Documentation">
                    <MdLink href={documentationLinks.autoGiveStudentRole}>
                        Learn more about auto give student role here.
                    </MdLink>
                </EmbedField>
                <EmbedField name="Current Configuration">
                    {server.autoGiveStudentRole
                        ? `**Enabled** - New members will automatically assigned <@&${server.studentRoleID}>.`
                        : `**Disabled** - New members need to be manually assigned <@&${server.studentRoleID}>.`}
                </EmbedField>
                <EmbedFooter>
                    Page {currentPage}/{NUM_PAGES}
                </EmbedFooter>
            </Embed>

            <ActionRow>
                <Button
                    label="Enable"
                    emoji="☑"
                    onClick={() => server.setAutoGiveStudentRole(true).then(complete)}
                />
                <Button
                    label="Disable"
                    emoji="🚫"
                    onClick={() => server.setAutoGiveStudentRole(false).then(complete)}
                />
            </ActionRow>
        </>
    );
}

function LoggingChannel({
    serverId,
    currentPage,
    assignedIndex
}: QuickStartPageProps): JSX.Element {
    if (currentPage !== assignedIndex) {
        return <></>;
    }

    const server = AttendingServerV2.get(serverId);
    const setLoggingChannelCommandId = useMemo(
        () =>
            server.guild.commands.cache.find(
                command => command.name === CommandNames.set_logging_channel
            )?.id,
        [serverId]
    );
    const possibleLoggingChannels = useMemo(
        () =>
            server.guild.channels.cache
                .filter(
                    channel =>
                        isTextChannel(channel) &&
                        channel.name !== 'queue' &&
                        channel.name !== 'chat'
                )
                .sort(
                    (channel1, channel2) =>
                        longestCommonSubsequence(channel2.name.toLowerCase(), 'logs') -
                        longestCommonSubsequence(channel1.name.toLowerCase(), 'logs')
                ),
        [serverId]
    );
    const [selectedChannelId, setSelectedChannelId] = useState<Snowflake>('');

    return (
        <>
            <Embed color={EmbedColor.Aqua}>
                <EmbedTitle>Quick Start - Logging Channel</EmbedTitle>
                <EmbedField name="Description">
                    YABOB can log any interactions with it, such as commands, buttons and
                    more. This is useful if you run into any unexpected errors involving
                    YABOB.
                    <Br repeat={2} />
                    You can enable logging by selecting a text channel from the dropdown
                    menu below. If you wish to disable logging, select the
                    <B>Disable</B>
                    option.
                </EmbedField>
                <EmbedField name="Documentation">
                    [Learn more about YABOB logging channels here.](
                    {documentationLinks.loggingChannel})
                </EmbedField>
                <EmbedField name="Note: Select menu length limit">
                    Discord only allows up to 25 options in this select menu. If your
                    desired logging channel is not listed, you can use the{' '}
                    {setLoggingChannelCommandId ? (
                        `</set_logging_channel:${setLoggingChannelCommandId}>`
                    ) : (
                        <InlineCode>/set_logging_channel</InlineCode>
                    )}
                </EmbedField>
                <EmbedFooter>
                    Page {currentPage}/{NUM_PAGES}{' '}
                    {selectedChannelId !== '' && (
                        <>
                            ● ✅ Successfully set{' '}
                            <B>
                                {server.guild.channels.cache.get(selectedChannelId)!.name}
                            </B>{' '}
                            as the logging channel!
                        </>
                    )}
                </EmbedFooter>
            </Embed>
            <Select
                placeholder="Select a Text Channel"
                value={selectedChannelId}
                onChangeValue={value => {
                    const loggingChannel = server.guild.channels.cache.get(value);
                    if (isTextChannel(loggingChannel)) {
                        server
                            .setLoggingChannel(loggingChannel)
                            .then(() => setSelectedChannelId(value));
                    }
                }}
            >
                {possibleLoggingChannels.first(25).map(channel => (
                    <Option key={channel.id} value={channel.id} label={channel.name} />
                ))}
            </Select>
        </>
    );
}

function LastPage({
    serverId,
    currentPage,
    assignedIndex
}: QuickStartPageProps): JSX.Element {
    if (currentPage !== assignedIndex) {
        return <></>;
    }
    const server = AttendingServerV2.get(serverId);
    const settingsCommandId = server.guild.commands.cache.find(
        command => command.name === CommandNames.settings
    )?.id;
    return (
        <Embed>
            <EmbedTitle>QuickStart - Last Page!</EmbedTitle>
            Congratulations! You have completed the quick start guide. If you have any
            questions, check out <MdLink href={wikiBaseUrl}>
                the guide on github
            </MdLink>{' '}
            or join{' '}
            <MdLink href={supportServerInviteLink}>the support discord server</MdLink>.
            There are many other functionalities of YABOB that you can explore via the
            {settingsCommandId ? `</settings:${settingsCommandId}>` : '`/settings`'} menu.
            <EmbedFooter>
                Page {currentPage}/{NUM_PAGES}
            </EmbedFooter>
        </Embed>
    );
}

export { QuickStartRoot };
