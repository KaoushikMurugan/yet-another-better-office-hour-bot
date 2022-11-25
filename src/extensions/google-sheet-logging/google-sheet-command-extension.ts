import { CacheType, ChatInputCommandInteraction, Guild } from "discord.js";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { isServerInteraction } from "../../command-handling/common-validations.js";
import { CommandData } from "../../command-handling/slash-commands.js";
import { environment } from "../../environment/environment-manager.js";
import { blue, red, yellow } from "../../utils/command-line-colors.js";
import { EmbedColor, ErrorEmbed, SimpleEmbed, SlashCommandLogEmbed } from "../../utils/embed-helper.js";
import { ExtensionSetupError } from "../../utils/error-types.js";
import { CommandCallback, YabobEmbed } from "../../utils/type-aliases.js";
import { logSlashCommand } from "../../utils/util-functions.js";
import { BaseInteractionExtension, IInteractionExtension } from "../extension-interface.js";
import { GoogleSheetLoggingExtension } from "./google-sheet-logging.js";
import { googleSheetsCommands } from "./google-sheet-slash-commands.js";

class GoogleSheetInteractionExtension
    extends BaseInteractionExtension
    implements IInteractionExtension
{
    constructor(private guild: Guild, private googleSheet: GoogleSpreadsheet) {
        super();
    }

    private static helpEmbedsSent = false;

    /**
     * Returns a new GoogleSheetLoggingExtension for the server with the given name
     * - Uses the google sheet id from the environment
     * @param guild
     * @throws ExtensionSetupError if
     * - the google sheet id is not set in the environment
     * - the google sheet id is invalid
     * - the google sheet is not accessible
     */
     static async load(guild: Guild): Promise<GoogleSheetInteractionExtension> {
        if (environment.googleSheetLogging.YABOB_GOOGLE_SHEET_ID.length === 0) {
            throw new ExtensionSetupError(
                'No Google Sheet ID or Google Cloud credentials found.'
            );
        }
        const googleSheet = new GoogleSpreadsheet(
            environment.googleSheetLogging.YABOB_GOOGLE_SHEET_ID
        );
        await googleSheet.useServiceAccountAuth(environment.googleCloudCredentials);
        await googleSheet.loadInfo().catch(() => {
            throw new ExtensionSetupError(
                red(
                    `Failed to load google sheet for ${guild.name}. ` +
                        `Google sheets rejected our connection.`
                )
            );
        });
        // console.log(
        //     `[${blue('Google Sheet Logging')}] ` +
        //         `successfully loaded for '${guild.name}'!\n` +
        //         ` - Using this google sheet: ${yellow(googleSheet.title)}`
        // );
        return new GoogleSheetInteractionExtension(guild, googleSheet);
    }

    override get slashCommandData(): CommandData {
        return googleSheetsCommands;
    }

    override canHandleCommand(interaction: ChatInputCommandInteraction): boolean {
        return interaction.commandName in commandMethodMap;
    }

    override async processCommand(
        interaction: ChatInputCommandInteraction<'cached'>
    ): Promise<void> {
        //Send logs before* processing the command
        const server = isServerInteraction(interaction);
        await interaction.reply({
            ...SimpleEmbed(
                `Processing command \`${interaction.commandName}\` ...`,
                EmbedColor.Neutral
            ),
            ephemeral: true
        });
        server.sendLogMessage(SlashCommandLogEmbed(interaction));
        const commandMethod = commandMethodMap[interaction.commandName];
        logSlashCommand(interaction);
        await commandMethod?.(interaction)
            .then(successMessage => interaction.editReply(successMessage))
            .catch(async err =>
                interaction.replied
                    ? await interaction.editReply(ErrorEmbed(err, server.botAdminRoleID))
                    : await interaction.reply({
                          ...ErrorEmbed(err, server.botAdminRoleID),
                          ephemeral: true
                      })
            );
    }

}

const commandMethodMap: { [commandName: string]: CommandCallback} = {
    get_statistics: getStatistics
}

async function getStatistics(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    return SimpleEmbed(
        'nothing has been implemented yet'
    );
}

export { GoogleSheetInteractionExtension };