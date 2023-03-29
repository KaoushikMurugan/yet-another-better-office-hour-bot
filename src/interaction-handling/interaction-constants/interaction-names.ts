/**
 * @packageDocumentation
 * This file contains all the names that are encoded in setCustomId and setCommandName
 * New Interaction names should also be placed in this file to avoid circular dependency
 * Values and enum names should the same because values are also used as keys
 */

/** Known base yabob slash command names */
enum CommandNames {
    announce = 'announce',
    cleanup_queue = 'cleanup_queue',
    cleanup_all = 'cleanup_all',
    cleanup_help_channels = 'cleanup_help_channels',
    clear = 'clear',
    clear_all = 'clear_all',
    enqueue = 'enqueue',
    leave = 'leave',
    list_helpers = 'list_helpers',
    next = 'next',
    queue = 'queue',
    start = 'start',
    pause = 'pause',
    resume = 'resume',
    stop = 'stop',
    help = 'help',
    queue_notify = 'queue_notify',
    set_logging_channel = 'set_logging_channel',
    stop_logging = 'stop_logging',
    create_offices = 'create_offices',
    set_roles = 'set_roles',
    settings = 'settings'
}

/**
 * Known base yabob button names
 */
enum ButtonNames {
    Join = 'Join',
    Leave = 'Leave',
    Notif = 'Notif',
    RemoveNotif = 'RemoveNotif',
    ReturnToMainMenu = 'ReturnToMainMenu',
    ServerRoleConfig1 = 'ServerRoleConfig1',
    ServerRoleConfig1a = 'ServerRoleConfig1a',
    ServerRoleConfig2 = 'ServerRoleConfig2',
    ServerRoleConfig2a = 'ServerRoleConfig2a',
    DisableAfterSessionMessage = 'DisableAfterSessionMessage',
    DisableQueueAutoClear = 'DisableQueueAutoClear',
    DisableLoggingChannel = 'DisableLoggingChannel',
    AutoGiveStudentRoleConfig1 = 'AutoGiveStudentRoleConfig1',
    AutoGiveStudentRoleConfig2 = 'AutoGiveStudentRoleConfig2',
    ShowAfterSessionMessageModal = 'ShowAfterSessionMessageModal',
    ShowQueueAutoClearModal = 'ShowQueueAutoClearModal',
    PromptHelpTopicConfig1 = 'PromptHelpTopicConfig1',
    PromptHelpTopicConfig2 = 'PromptHelpTopicConfig2',
    SeriousModeConfig1 = 'SeriousModeConfig1',
    SeriousModeConfig2 = 'SeriousModeConfig2',
    HelpMenuLeft = 'HelpMenuLeft',
    HelpMenuRight = 'HelpMenuRight',
    HelpMenuBotAdmin = 'HelpMenuBotAdmin',
    HelpMenuStaff = 'HelpMenuStaff',
    HelpMenuStudent = 'HelpMenuStudent',
    ReturnToHelpMainMenu = 'ReturnToHelpMainMenu',
    ReturnToHelpAdminSubMenu = 'ReturnToHelpAdminSubMenu',
    ReturnToHelpStaffSubMenu = 'ReturnToHelpStaffSubMenu',
    ReturnToHelpStudentSubMenu = 'ReturnToHelpStudentSubMenu'
}

/**
 * Known base yabob modal names
 */
enum ModalNames {
    AfterSessionMessageModal = 'AfterSessionMessageModal',
    AfterSessionMessageModalMenuVersion = 'AfterSessionMessageModalMenuVersion',
    QueueAutoClearModal = 'QueueAutoClearModal',
    QueueAutoClearModalMenuVersion = 'QueueAutoClearModalMenuVersion',
    PromptHelpTopicModal = 'PromptHelpTopicModal'
}

/** Known base yabob select menu names */
enum SelectMenuNames {
    ServerSettings = 'ServerSettings',
    SelectLoggingChannel = 'SelectLoggingChannel',
    HelpMenu = 'HelpMenu'
}

export { CommandNames, ButtonNames, ModalNames, SelectMenuNames };
