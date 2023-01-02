import { Collection, Guild, Snowflake } from 'discord.js';
import { GoogleSheetServerExtension } from './google-sheet-server-extension.js';
import { GuildId } from '../../utils/type-aliases.js';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { environment } from '../../environment/environment-manager.js';
import { yellow, blue } from '../../utils/command-line-colors.js';
import { ExtensionSetupError } from '../../utils/error-types.js';
import { IServerExtension } from '../extension-interface.js';
import { firebaseDB } from '../../global-states.js';
import { z } from 'zod';
import { logWithTimeStamp } from '../../utils/util-functions.js';
import { loadSheetById } from './shared-sheet-functions.js';

/**
 * Backup type
 */
type GoogleSheetBackup = {
    sheetId: string;
};

/**
 * Responsible for maintaining server level states of the google sheet extension
 */
class GoogleSheetExtensionState {
    /**
     * Firebase backup schema
     */
    static readonly backupSchema = z.object({ sheetId: z.string() });

    /**
     * Collection of all the state objects
     * - static, so it's shared across all instances
     * - key is guild id, value is 1 google sheet extension state
     */
    static guildLevelStates = new Collection<GuildId, GoogleSheetExtensionState>();

    /**
     * Constructor
     * @param serverExtension the corresponding server level extension
     */
    protected constructor(
        readonly guild: Guild,
        private serverExtension: Omit<GoogleSheetServerExtension, keyof IServerExtension>,
        private _googleSheet: GoogleSpreadsheet
    ) {}

    /**
     * The google sheet object
     */
    get googleSheet(): GoogleSpreadsheet {
        return this._googleSheet;
    }

    /**
     * Loads the extension states for 1 guild
     * - This should be called inside the GoogleSheetServerExtension.load method
     * @param guild
     * @param serverExtension the newly created server extension
     * - unused, it's only here as an example
     * @returns a new state instance
     */
    static async load(
        guild: Guild,
        serverExtension: GoogleSheetServerExtension
    ): Promise<GoogleSheetExtensionState> {
        if (
            environment.googleSheetLogging.YABOB_GOOGLE_SHEET_ID.length === 0 ||
            environment.googleCloudCredentials.client_email.length === 0 ||
            environment.googleCloudCredentials.private_key.length === 0
        ) {
            throw new ExtensionSetupError(
                'No default Google Sheet ID or Google Cloud credentials found.'
            );
        }
        const backupData = await GoogleSheetExtensionState.restoreFromBackup(guild.id);
        const googleSheet = await loadSheetById(backupData.sheetId);
        const instance = new GoogleSheetExtensionState(
            guild,
            serverExtension,
            googleSheet
        );
        // add the new state to the static collection
        GoogleSheetExtensionState.guildLevelStates.set(guild.id, instance);
        console.log(
            `[${blue('Google Sheet Logging')}] ` +
                `successfully loaded for '${yellow(guild.name)}'!\n` +
                ` - Using this google sheet: ${yellow(googleSheet.title)}`
        );
        return instance;
    }

    /**
     * Changes which google sheet this yabob reads from
     * - TODO: for now, this does not move any of the old data to the new google sheet
     * @param sheetId the id of the new google sheet, found in the google sheet's url
     */
    async setGoogleSheet(sheetId: string): Promise<void> {
        this._googleSheet = await loadSheetById(sheetId);
        this.backupToFirebase();
    }

    /**
     * Restores the google sheet config from firebase
     * @param serverId
     */
    private static async restoreFromBackup(
        serverId: Snowflake
    ): Promise<GoogleSheetBackup> {
        const backupDoc = await firebaseDB
            .collection('googleSheetBackups')
            .doc(serverId)
            .get();
        if (backupDoc.data() === undefined) {
            return { sheetId: environment.googleSheetLogging.YABOB_GOOGLE_SHEET_ID };
        }
        const backupData = GoogleSheetExtensionState.backupSchema.safeParse(
            backupDoc.data()
        );
        if (!backupData.success) {
            return { sheetId: environment.googleSheetLogging.YABOB_GOOGLE_SHEET_ID };
        }
        return backupData.data;
    }

    private backupToFirebase(): void {
        const backupData: GoogleSheetBackup = {
            sheetId: this.googleSheet.spreadsheetId
        };
        firebaseDB
            .collection('googleSheetBackups')
            .doc(this.guild.id)
            .set(backupData)
            .then(() =>
                logWithTimeStamp(
                    this.guild.name,
                    '- Google sheet config backup successful.'
                )
            )
            .catch((err: Error) =>
                console.error('Firebase calendar backup failed.', err.message)
            );
    }
}

export { GoogleSheetExtensionState };