const documentationBaseUrl =
    'https://github.com/KaoushikMurugan/yet-another-better-office-hour-bot/wiki/Configure-YABOB-Settings-For-Your-Server' as const;

/**
 * Links to the documentation
 */
const documentationLinks = {
    main: documentationBaseUrl,
    serverRoles: `${documentationBaseUrl}#server-roles`,
    autoClear: `${documentationBaseUrl}#queue-auto-clear`,
    loggingChannel: `${documentationBaseUrl}#logging-channel`,
    afterSessionMessage: `${documentationBaseUrl}#after-session-message`,
    autoGiveStudentRole: `${documentationBaseUrl}#auto-give-student-role`,
    promptHelpTopic: `${documentationBaseUrl}#help-topic-prompt`,
    seriousMode: `${documentationBaseUrl}#serious-mode`
};

const wikiBaseUrl =
    'https://github.com/KaoushikMurugan/yet-another-better-office-hour-bot/wiki';

const supportServerInviteLink = 'https://discord.gg/p7HS92mHsG';

export { documentationLinks, wikiBaseUrl, supportServerInviteLink };
