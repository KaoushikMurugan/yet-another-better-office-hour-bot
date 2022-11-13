import { EmbedColor, SimpleEmbed, SimpleLogEmbed } from '../../utils/embed-helper.js';

const CalendarSuccessMessages = {
    updatedCalendarId: (newCalendarName: string) =>
        SimpleEmbed(
            'Successfully changed to new calendar ' +
                `${
                    newCalendarName.length > 0
                        ? ` '${newCalendarName}'. `
                        : ", but it doesn't have a name. "
                }` +
                'The calendar embeds will refresh soon. ' +
                "Don't forget sure to use '/set_public_embed_url' " +
                'if you are using a 3rd party calendar public embed. ' +
                'This ID has also been backed up to firebase.',
            EmbedColor.Success
        ),
    unsetCalendar: SimpleEmbed(
        'Successfully unset the calendar. ' +
            'The calendar embeds will refresh soon. ' +
            'Or you can manually refresh it using the refresh button.',
        EmbedColor.Success
    ),
    completedCalendarString: (calendarDisplayName: string, validQueueNames: string[]) =>
        SimpleEmbed(
            'Copy and paste the following into the calendar **description**:\n\n' +
                'YABOB_START ' +
                `${calendarDisplayName} - ` +
                `${validQueueNames.join(', ')} ` +
                'YABOB_END\n',
            EmbedColor.Success
        ),
    publicEmbedUrl: {
        updated: SimpleEmbed(
            'Successfully changed the public embed url. ' +
                'The links in the titles of calendar queue embed will refresh soon.',
            EmbedColor.Success
        ),
        backToDefault: SimpleEmbed(
            'Successfully changed to **default** embed url. ' +
                'The links in the titles of calendar queue embed will refresh soon.',
            EmbedColor.Success
        )
    },
    updatedCalendarSettings: (calendarId: string, publicEmbedUrl: string) =>
        SimpleEmbed(
            'Successfully updated the calendar settings as follows:' +
                `\n\n**Calendar ID:** ${calendarId}` +
                `\n**Public Embed Url:** ${publicEmbedUrl}\n\n` +
                'The calendar embeds will refresh soon. ' +
                'Or you can manually refresh it using the refresh button.',
            EmbedColor.Success
        ),
    refreshSuccess: (queueName: string) =>
        SimpleEmbed(
            `Successfully refreshed upcoming hours for ${queueName}. The embeds will update soon.`,
            EmbedColor.Success
        )
} as const;

const CalendarLogMessages = {
    backedUpToFirebase: SimpleLogEmbed('Updated calendar ID and stored in firebase')
} as const;

export { CalendarSuccessMessages, CalendarLogMessages };
