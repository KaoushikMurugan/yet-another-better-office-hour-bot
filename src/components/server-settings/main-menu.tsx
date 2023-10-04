import { Snowflake } from 'discord.js';
import { Embed, EmbedField, EmbedFooter, EmbedTitle } from 'reacord';
import React from 'react';
import { AttendingServerV2 } from '../../attending-server/base-attending-server';
import { EmbedColor } from '../../utils/embed-helper';
import { documentationLinks } from '../../utils/documentation-helper';
import { MdLink } from '../helper-components';

function MainMenu({ serverId }: { serverId: Snowflake }): JSX.Element {
    const server = AttendingServerV2.get(serverId);
    return (
        <Embed color={EmbedColor.Aqua}>
            <EmbedTitle>🛠 Server Settings for {server.guild.name} 🛠</EmbedTitle>
            This is the main menu for server settings. Select an option from the drop-down
            menu below to enter the individual configuration menus.
            <EmbedField name="User Manual">
                Check out our{' '}
                <MdLink href={documentationLinks.main}>documentation</MdLink> for detailed
                description of each setting.
            </EmbedField>
            <EmbedFooter>
                Your settings are always automatically saved as soon as you make a change.
                Dismiss this message at any time to finish configuring YABOB.
            </EmbedFooter>
        </Embed>
    );
}

export default MainMenu;
