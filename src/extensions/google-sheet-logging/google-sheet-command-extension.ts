import { ChatInputCommandInteraction, Guild } from 'discord.js';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { isServerInteraction } from '../../command-handling/common-validations.js';
import { CommandData } from '../../command-handling/slash-commands.js';
import { environment } from '../../environment/environment-manager.js';
import { red } from '../../utils/command-line-colors.js';
import {
    EmbedColor,
    ErrorEmbed,
    SimpleEmbed,
    SlashCommandLogEmbed
} from '../../utils/embed-helper.js';
import { ExtensionSetupError } from '../../utils/error-types.js';
import { CommandCallback, YabobEmbed } from '../../utils/type-aliases.js';
import { logSlashCommand } from '../../utils/util-functions.js';
import {
    BaseInteractionExtension,
    IInteractionExtension
} from '../extension-interface.js';
import { getServerGoogleSheet } from './google-sheet-logging.js';
import { googleSheetsCommands } from './google-sheet-slash-commands.js';

class GoogleSheetInteractionExtension
    extends BaseInteractionExtension
    implements IInteractionExtension
{
    constructor() {
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
        return new GoogleSheetInteractionExtension();
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

const commandMethodMap: { [commandName: string]: CommandCallback } = {
    get_statistics: getStatistics
};

/**
 * The `/get_statistics` command
 * @param interaction
 * @returns
 */
async function getStatistics(
    interaction: ChatInputCommandInteraction<'cached'>
): Promise<YabobEmbed> {
    // get the doc for this server
    const server = isServerInteraction(interaction);
    const googleSheet = getServerGoogleSheet(server);
    if (!googleSheet) {
        throw new Error(
            `No google sheet found for server ${server.guild.name}. ` +
                `Did you forget to set the google sheet id in the environment?`
        );
    }

    const sheetTitle = `${server.guild.name.replace(/:/g, ' ')} Attendance`.replace(
        /\s{2,}/g,
        ' '
    );

    const attendanceSheet = googleSheet.sheetsByTitle[sheetTitle];

    if (!attendanceSheet) {
        throw new Error(
            `No help session sheet found for server ${server.guild.name}. ` +
                `Did you forget to set the google sheet id in the environment?`
        );
    }

    const rows = await attendanceSheet.getRows();

    const helpSessionCount = rows.length;

    const totalSessionTime = rows
        .map(row => {
            return parseInt(row['Session Time (ms)']);
        })
        .filter((time: number) => !isNaN(time))
        .reduce((a, b) => a + b, 0);

    const totalSessionTimeHours = totalSessionTime / (1000 * 60 * 60);
    const totalSessionTimeMinutes = totalSessionTime / (1000 * 60);

    const numberOfStudents = rows
        .map(row => {
            return parseInt(row['Number of Students Helped']);
        })
        .filter((num: number) => !isNaN(num))
        .reduce((a, b) => a + b, 0);

    return SimpleEmbed(
        `Help session statistics for ${server.guild.name}`,
        EmbedColor.Neutral,
        `Help sessions: ${helpSessionCount}\n` +
            `Total session time: ${totalSessionTimeHours} h ${totalSessionTimeMinutes} min\n` +
            `Number of students helped: ${numberOfStudents}\n`
    );
}

export { GoogleSheetInteractionExtension };
