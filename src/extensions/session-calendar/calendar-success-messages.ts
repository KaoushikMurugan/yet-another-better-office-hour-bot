const CalendarSuccessMessages = {
    updatedCalendarId: (newCalendarName: string) =>
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
    backedupToFirebase: 'Updated calendar ID and stored in firebase',
    unsetCalendar:
        'Successfully unset the calendar. ' +
        'The calendar embeds will refresh soon. ' +
        'Or you can manually refresh it using the refresh button.',
    completedCalendarString: (calendarDisplayName: string, validQueueNames: string[]) =>
        `Copy and paste the following into the calendar **description**:\n\n` +
        `YABOB_START ` +
        `${calendarDisplayName} - ` +
        `${validQueueNames.join(', ')} ` +
        `YABOB_END\n`,
    publicEmbedUrl: {
        updated:
            `Successfully changed the public embed url. ` +
            `The links in the titles of calendar queue embed will refresh soon.`,
        backToDefault:
            `Successfully changed to **default** embed url. ` +
            `The links in the titles of calendar queue embed will refresh soon.`
    },
    refreshSuccess: (queueName: string) =>
        `Successfully refreshed upcoming hours for ${queueName}`
} as const;

export { CalendarSuccessMessages };
