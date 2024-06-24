import { ButtonHandlerProps, CommandHandlerProps } from '../../interaction-handling/handler-interface.js';
import { CommandData } from '../../utils/type-aliases.js';
import { BaseInteractionExtension } from '../extension-interface.js';
import { activityTrackingSettingsMainMenuOptions } from './constants/settings-menu.js';
import { activityTrackingSlashCommands } from './constants/slash-commands.js';
import { activityTrackingButtonMap } from './interaction-handling/button-handler.js';
import { activityTrackingCommandMap } from './interaction-handling/command-handler.js';

class HelperActivityTrackingInteractionExtension extends BaseInteractionExtension {
    override slashCommandData: CommandData = activityTrackingSlashCommands;
    override commandMap: CommandHandlerProps = activityTrackingCommandMap;
    override buttonMap: ButtonHandlerProps = activityTrackingButtonMap;
    override settingsMainMenuOptions = activityTrackingSettingsMainMenuOptions;
}

export { HelperActivityTrackingInteractionExtension };
