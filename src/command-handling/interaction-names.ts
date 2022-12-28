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
    set_logging_channel = 'set_logging_channel',
    stop_logging = 'stop_logging',
    serious_mode = 'serious_mode',
    create_offices = 'create_offices',
    set_roles = 'set_roles',
    settings = 'settings',
    auto_give_student_role = 'auto_give_student_role',
    set_after_session_msg = 'set_after_session_msg',
    set_queue_auto_clear = 'set_queue_auto_clear'
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
    ShowQueueAutoClearModal = 'ShowQueueAutoClearModal'
}

/**
 * Known base yabob modal names
 */
enum ModalNames {
    AfterSessionMessageModal = 'AfterSessionMessageModal',
    AfterSessionMessageModalMenuVersion = 'AfterSessionMessageModalMenuVersion',
    QueueAutoClearModal = 'QueueAutoClearModal',
    QueueAutoClearModalMenuVersion = 'QueueAutoClearModalMenuVersion'
}

/** Known base yabob select menu names */
enum SelectMenuNames {
    ServerSettings = 'ServerSettings',
    SelectLoggingChannel = 'SelectLoggingChannel'
}

export { CommandNames, ButtonNames, ModalNames, SelectMenuNames };
