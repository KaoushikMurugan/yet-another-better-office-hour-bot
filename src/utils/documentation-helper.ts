const settingsDocBaseUrl =
    'https://tomli380576.github.io/yabob-docs/user-docs/settings/' as const;

/**
 * Links to the documentation
 */
const documentationLinks = {
    main: settingsDocBaseUrl,
    serverRoles: `${settingsDocBaseUrl}#server-roles`,
    autoClear: `${settingsDocBaseUrl}#queue-auto-clear`,
    loggingChannel: `${settingsDocBaseUrl}#logging-channel`,
    afterSessionMessage: `${settingsDocBaseUrl}#after-session-message`,
    autoGiveStudentRole: `${settingsDocBaseUrl}#auto-give-student-role`,
    promptHelpTopic: `${settingsDocBaseUrl}#help-topic-prompt`,
    seriousMode: `${settingsDocBaseUrl}#serious-mode`
};

const wikiBaseUrl = 'https://tomli380576.github.io/yabob-docs/';

const supportServerInviteLink = 'https://discord.gg/p7HS92mHsG';

export { documentationLinks, settingsDocBaseUrl,wikiBaseUrl, supportServerInviteLink };
