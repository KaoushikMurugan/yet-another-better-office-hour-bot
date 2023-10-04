import { Snowflake } from 'discord.js';
import React, { useMemo, useState } from 'react';
import { SpecialRoleValues } from '../../utils/type-aliases';
import { AttendingServerV2 } from '../../attending-server/base-attending-server';
import { CommandNames } from '../../interaction-handling/interaction-constants/interaction-names';
import { ActionRow, Button, Embed, EmbedField, EmbedFooter, EmbedTitle, OptionProps } from 'reacord';
import { EmbedColor } from '../../utils/embed-helper';
import { B, MdLink } from '../helper-components';
import { documentationLinks } from '../../utils/documentation-helper';

function generatePing(id: Snowflake | SpecialRoleValues) {
    return id === SpecialRoleValues.NotSet
        ? 'Not Set'
        : id === SpecialRoleValues.Deleted
        ? '@deleted-role'
        : `<@&${id}>`;
}

function RoleConfigMenu({ serverId }: { serverId: Snowflake }): JSX.Element {
    const server = AttendingServerV2.get(serverId);
    const [success, setSuccess] = useState<'success' | 'error' | 'none'>('none');
    const setRolesCommandId = useMemo(
        () =>
            server.guild.commands.cache.find(
                command => command.name === CommandNames.set_roles
            )?.id,
        [serverId]
    );

    return (
        <>
            <Embed color={EmbedColor.Aqua}>
                <EmbedTitle>
                    📝 Server Roles Configuration for {server.guild.name} 📝
                </EmbedTitle>
                <EmbedField name="Description">
                    Configures which roles should YABOB interpret as Bot Admin, Staff, and
                    Student.
                </EmbedField>
                <EmbedField name="Documentation">
                    <MdLink href={documentationLinks.serverRoles}>
                        Learn more about YABOB roles here.
                    </MdLink>{' '}
                    For more granular control, use the{' '}
                    {`</set_roles:${setRolesCommandId}>`} command.
                </EmbedField>

                <EmbedField name={'┈'.repeat(25)}>
                    <B>Current Role Configuration</B>
                </EmbedField>
                <EmbedField name="🤖 Bot Admin Role">
                    {generatePing(server.botAdminRoleID)}
                </EmbedField>
                <EmbedField name="📚 Staff Role">
                    {generatePing(server.staffRoleID)}
                </EmbedField>
                <EmbedField name="🎓 Student Role">
                    {generatePing(server.studentRoleID)}
                </EmbedField>
                {success === 'success' && (
                    <EmbedFooter>✅ Successfully updated server roles!</EmbedFooter>
                )}
                {success === 'error' && (
                    <EmbedFooter>
                        <EmbedFooter>
                            ❌ Failed to update server roles. Does YABOB have permission
                            to edit roles?
                        </EmbedFooter>
                    </EmbedFooter>
                )}
            </Embed>

            <ActionRow>
                <Button
                    onClick={() =>
                        server
                            .createAccessLevelRoles(false, false)
                            .then(() => setSuccess('success'))
                            .catch(() => setSuccess('error'))
                    }
                    label="Use Existing Roles"
                    emoji="🔵"
                />
                <Button
                    onClick={() =>
                        server
                            .createAccessLevelRoles(false, true)
                            .then(() => setSuccess('success'))
                            .catch(() => setSuccess('error'))
                    }
                    label="Use Existing Roles (@everyone is student)"
                    emoji="🔵"
                />
            </ActionRow>
        </>
    );
}

export default RoleConfigMenu;
