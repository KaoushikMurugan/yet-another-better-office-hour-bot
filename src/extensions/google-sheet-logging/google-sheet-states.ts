import { Collection, Guild, Snowflake } from 'discord.js';
import { GoogleSheetServerExtension } from './google-sheet-server-extension.js';
import { GuildId, Optional } from '../../utils/type-aliases.js';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { environment } from '../../environment/environment-manager.js';
import { ServerExtension } from '../extension-interface.js';
import { client, firebaseDB } from '../../global-states.js';
import { GOOGLE_SHEET_LOGGER } from './shared-sheet-functions.js';
import { z } from 'zod';
import { loadSheetById } from './shared-sheet-functions.js';
import { ExpectedSheetErrors } from './google-sheet-constants/expected-sheet-errors.js';

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
     * Collection of all the state objects
     * - static, so it's shared across all instances
     * - key is guild id, value is 1 google sheet extension state
     */
    static readonly allStates = new Collection<GuildId, GoogleSheetExtensionState>();
    /**
     * Firebase backup schema
     */
    static readonly backupSchema = z.object({ sheetId: z.string() });

    /**
     * @param guild
     * @param serverExtension the corresponding server extension for the same guild
     * @param _googleSheet this cannot be directly initialized, so the restoreBackup method is static
     */
    protected constructor(
        readonly guild: Guild,
        private serverExtension: Omit<GoogleSheetServerExtension, keyof ServerExtension>,
        private _googleSheet: GoogleSpreadsheet
    ) {}

    /**
     * The google sheet object
     */
    get googleSheet(): GoogleSpreadsheet {
        return this._googleSheet;
    }

    /**
     * The public url of the google sheet document
     */
    get googleSheetURL(): string {
        return `https://docs.google.com/spreadsheets/d/${this.googleSheet.spreadsheetId}`;
    }

    /**
     * Gets the state object for this server id
     */
    static get(serverId: Snowflake): GoogleSheetExtensionState {
        const state = GoogleSheetExtensionState.allStates.get(serverId);
        if (!state) {
            throw ExpectedSheetErrors.nonServerInteraction(
                client.guilds.cache.get(serverId)?.name
            );
        }
        return state;
    }

    static safeGet(serverId: Snowflake): Optional<GoogleSheetExtensionState> {
        return GoogleSheetExtensionState.allStates.get(serverId);
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
        serverExtension: Omit<GoogleSheetServerExtension, keyof ServerExtension>
    ): Promise<GoogleSheetExtensionState> {
        const backupData = await GoogleSheetExtensionState.restoreFromBackup(guild.id);
        const googleSheet = await loadSheetById(backupData.sheetId);
        const instance = new GoogleSheetExtensionState(
            guild,
            serverExtension,
            googleSheet
        );
        // add the new state to the static collection
        GoogleSheetExtensionState.allStates.set(guild.id, instance);
        GOOGLE_SHEET_LOGGER.info(
            { googleSheet: googleSheet.title },
            `Successfully loaded for ${guild.name}!`
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
                GOOGLE_SHEET_LOGGER.info(
                    `Google sheet config backup successful for ${this.guild.name}.`
                )
            )
            .catch((err: Error) =>
                GOOGLE_SHEET_LOGGER.error(err, 'Firebase google sheet backup failed.')
            );
    }
}

export { GoogleSheetExtensionState };
