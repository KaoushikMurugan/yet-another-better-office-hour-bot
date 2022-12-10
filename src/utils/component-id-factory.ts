import {
    TextBasedChannelId,
    GuildId,
    ComponentLocation,
    Result,
    Err,
    Ok
} from './type-aliases.js';
import LZString from 'lz-string';
import {
    ButtonBuilder,
    ModalBuilder,
    SelectMenuBuilder,
} from 'discord.js';
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

/** A tuple that represents the infomation encoded in a custom id */
type CustomIdTuple<T extends ComponentLocation> = [
    type: T,
    componentName: string,
    serverId: GuildId,
    channelId: TextBasedChannelId
];

/**
 * Function variant of YabobComponentFactory, takes over the builder's setCustomId method
 * @param builder builder method that has 'setCustomId'
 * @param idInfo the information to compress into the id
 * @returns builder, but without setCustomId
 * @example
 * ```ts
 * // type is inferred as buildComponent<'dm', ButtonBuilder>
 * const a = buildComponent(new ButtonBuilder(), ['dm', 'bruh', '11', '22']);
 * ```
 */
function buildComponent<
    T extends ComponentLocation,
    R extends { setCustomId: (customId: string) => R }
>(builder: R, idInfo: CustomIdTuple<T>): Omit<R, 'setCustomId'> {
    return builder.setCustomId(LZString.compressToUTF16(JSON.stringify(idInfo)));
}

/**
 * Test to see if the decompressed array is valid
 * @param expectedComponentType'queue' 'dm' or 'other'
 * - the consumer of this function needs to specify the correct type
 * @param decompressedTuple from JSON.parse
 * @returns boolean
 */
function isValidCustomIdTuple<T extends ComponentLocation>(
    expectedComponentType: T,
    decompressedTuple: string[]
): decompressedTuple is CustomIdTuple<T> {
    const lengthMatch = decompressedTuple.length === 4;
    const typeMatch = decompressedTuple[0] === expectedComponentType;
    const snowflakesAreValid = // snowflakes should only have numbers
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        /^[0-9]+$/.test(decompressedTuple[2]!) && /^[0-9]+$/.test(decompressedTuple[3]!);
    return lengthMatch && typeMatch && snowflakesAreValid;
}

/**
 * Decompresses the obfuscated id into CustomIdTuple
 * @param expectedComponentType 'queue' 'dm' or 'other'
 * - the consumer of this function needs to specify the correct type
 * @param compressedId the id to decompress
 * @returns the original tuple passed into buildComponent
 * @throws CommandParseError or JSONParseError
 */
function decompressComponentId<T extends ComponentLocation>(
    expectedComponentType: T,
    compressedId: string
): CustomIdTuple<T> {
    const rawDecompressed = LZString.decompressFromUTF16(compressedId);
    if (!rawDecompressed) {
        throw new CommandParseError('Invalid Component ID');
    }
    // have to cast, JSON parse returns any
    const parsed = JSON.parse(rawDecompressed);
    if (!isValidCustomIdTuple(expectedComponentType, parsed)) {
        throw new CommandParseError('Invalid Component ID');
    }
    return parsed;
}

/**
 * Non exception based version of {@link decompressComponentId}
 * @example 
 * ```ts
 * const decompressed = safeDecompressComponentId<'queue'>('some id');
 * decompressed.ok ? doForOk(decompressed.value) : doForErr(decompressed.error)
 * ```
 */
function safeDecompressComponentId<T extends ComponentLocation>(
    expectedComponentType: T,
    compressedId: string
): Result<CustomIdTuple<T>, CommandParseError> {
    const rawDecompressed = LZString.decompressFromUTF16(compressedId);
    if (!rawDecompressed) {
        return Err(new CommandParseError('Invalid Component ID'));
    }
    try {
        const parsed = JSON.parse(rawDecompressed);
        if (!isValidCustomIdTuple(expectedComponentType, parsed)) {
            return Err(new CommandParseError('Invalid Component ID'));
        }
        return Ok(JSON.parse(rawDecompressed) as CustomIdTuple<T>);
    } catch {
        return Err(new CommandParseError('Failed to parse component JSON'));
    }
}

export {
    buttonFactory,
    selectMenuFactory,
    modalFactory,
    YabobButtonFactory,
    YabobSelectMenuFactory,
    YabobModalFactory,
    buildComponent,
    decompressComponentId,
    safeDecompressComponentId
};
