import {
    TextBasedChannelId,
    GuildId,
    ComponentLocation,
    Result,
    Err,
    Ok
} from './type-aliases.js';
import LZString from 'lz-string';
import { ButtonBuilder, ModalBuilder, SelectMenuBuilder } from 'discord.js';
import { CommandParseError } from './error-types.js';

// Honestly idk if using abstract factory is an overkill
// but it should be easier to modify in the future by adding more abstract methods and implement them in the concrete classes
// I tried using function overloads but I couldn't figure out the correct types

/**
 * Abstract Factory class for components that have the setCustomId method
 */
abstract class YabobComponentFactory<
    U extends ButtonBuilder | SelectMenuBuilder | ModalBuilder
> {
    /**
     * Builds the discord js component, but takes over setCustomId
     * @param type queue, dm , or other
     * @param componentName expected component customId
     * @param serverId server id of where this component is supposed to be / comes from
     * @param channelId category channel id or the dm channel id
     */
    abstract buildComponent<T extends ComponentLocation>(
        type: T,
        componentName: string,
        serverId: T extends 'dm' ? GuildId : undefined,
        channelId: T extends 'other' ? undefined : TextBasedChannelId
    ): Omit<U, 'setCustomId'>;

    protected compressComponentId<T extends ComponentLocation>(
        type: T,
        componentName: string,
        serverId: T extends 'dm' ? GuildId : undefined,
        channelId: T extends 'other' ? undefined : TextBasedChannelId
    ): string {
        const id = LZString.compressToUTF16(
            JSON.stringify([type, componentName, serverId, channelId])
        );
        return id;
    }

    /**
     * Decompresses the component id that was compressed with LZString.compressToUTF16
     * @param compressedId the id to decompress
     * @returns the parameter tuple of buildComponent
     */
    decompressComponentId(compressedId: string): Parameters<typeof this.buildComponent> {
        const rawDecompressed = LZString.decompressFromUTF16(compressedId);
        if (!rawDecompressed) {
            throw new CommandParseError('Invalid Component ID');
        }
        const decompressed = JSON.parse(rawDecompressed);
        decompressed[2] ??= undefined; // JSON.parse returns null
        decompressed[3] ??= undefined;
        return decompressed;
    }

    /**
     * Non exception based version of {@link decompressComponentId}
     */
    safeDecompressComponentId(
        compressedId: string
    ): Result<Parameters<typeof this.buildComponent>, CommandParseError> {
        const rawDecompressed = LZString.decompressFromUTF16(compressedId);
        if (!rawDecompressed) {
            return Err(new CommandParseError('Invalid Component ID'));
        }
        try {
            const decompressed = JSON.parse(rawDecompressed);
            decompressed[2] ??= undefined; // JSON.parse returns null
            decompressed[3] ??= undefined;
            return Ok(decompressed);
        } catch {
            return Err(new CommandParseError('Failed to parse component JSON'));
        }
    }
}

/**
 * Concrete class for buttons
 * - usage:
 * `new YabobButtonFactory().buildComponent()` and chain regular builder methods
 * - or use the globally exported buttonFactory `buttonFactory.builtComponent()`
 */
class YabobButtonFactory extends YabobComponentFactory<ButtonBuilder> {
    buildComponent<T extends ComponentLocation>(
        type: T,
        componentName: string,
        serverId: T extends 'dm' ? GuildId : undefined,
        channelId: T extends 'other' ? undefined : TextBasedChannelId
    ): Omit<ButtonBuilder, 'setCustomId'> {
        return new ButtonBuilder().setCustomId(
            this.compressComponentId(type, componentName, serverId, channelId)
        );
    }
}

/**
 * Concrete class for select menus
 * - usage:
 * `new YabobSelectMenuFactory().buildComponent()` and chain regular builder methods
 * - or use the globally exported selectMenuFactory `selectMenuFactory.builtComponent()`
 */
class YabobSelectMenuFactory extends YabobComponentFactory<SelectMenuBuilder> {
    buildComponent<T extends ComponentLocation>(
        type: T,
        componentName: string,
        serverId: T extends 'dm' ? GuildId : undefined,
        channelId: T extends 'other' ? undefined : TextBasedChannelId
    ): Omit<SelectMenuBuilder, 'setCustomId'> {
        return new SelectMenuBuilder().setCustomId(
            this.compressComponentId(type, componentName, serverId, channelId)
        );
    }
}

/**
 * Concrete class for modals
 * - usage:
 * `new YabobModalFactory().buildComponent()` and chain regular builder methods
 * - or use the globally exported modalFactory `modalFactory.builtComponent()`
 */
class YabobModalFactory extends YabobComponentFactory<ModalBuilder> {
    buildComponent<T extends ComponentLocation>(
        type: T,
        componentName: string,
        serverId: T extends 'dm' ? string : undefined,
        channelId: T extends 'other' ? undefined : string
    ): Omit<ModalBuilder, 'setCustomId'> {
        return new ModalBuilder().setCustomId(
            this.compressComponentId(type, componentName, serverId, channelId)
        );
    }
}

const buttonFactory = new YabobButtonFactory();
const selectMenuFactory = new YabobSelectMenuFactory();
const modalFactory = new YabobModalFactory();

export {
    buttonFactory,
    selectMenuFactory,
    modalFactory,
    YabobButtonFactory,
    YabobSelectMenuFactory,
    YabobModalFactory
};
