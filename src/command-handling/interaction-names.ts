/**
 * @packageDocumentation
 * This file contains all the names that are encoded in setCustomId and setCommandName
 * New Interaction names should also be placed in this file to avoid circular dependency
 */

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

export { ButtonNames, ModalNames };
