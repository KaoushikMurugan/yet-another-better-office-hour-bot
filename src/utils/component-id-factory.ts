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

/** A tuple that represents the infomation encoded in a custom id */
type CustomIdTuple<T extends ComponentLocation> = [
    type: T,
    componentName: string,
    serverId: GuildId,
    channelId: TextBasedChannelId
];

/**
 * This variable is coupled with the type definition of CustomIdTuple
 * - if we ever add more stuff to CustomIdTuple, simply change the value after the equal sign
 * - there will be only 1 possible value
 * - can be extracted as `type TupleLength<T extends unknown[]> = T['length']`
 */
const ExpectedLength: CustomIdTuple<ComponentLocation>['length'] = 4 as const;

/**
 * Placeholder value for the CustomIdTuple if server id or channel id is not available
 */
const UnknownId = '0' as const;

/**
 * Function variant of YabobComponentFactory, takes over the builder's setCustomId method
 * @param builder builder method that has 'setCustomId'
 * @param idInfo the information to compress into the id
 * @returns builder, but without setCustomId
 * @remark the return type will guarantee that setCustomId doesn't show up for the first chained method,
 *  but chaining more methods will still expose the setCustomId method
 *  - be careful to avoid calling setCustomId
 * @example
 * ```ts
 * // type is inferred as buildComponent<'dm', ButtonBuilder>
 * const a = buildComponent(new ButtonBuilder(), ['dm', 'bruh', '11', '22']);
 * ```
 */
function buildComponent<
    T extends ComponentLocation,
    R extends ButtonBuilder | ModalBuilder | SelectMenuBuilder
>(builder: R, idInfo: CustomIdTuple<T>): Omit<R, 'setCustomId'> {
    builder.setCustomId(LZString.compressToUTF16(JSON.stringify(idInfo)));
    return builder;
}

/**
 * Test to see if the decompressed array is valid
 * @param expectedComponentType'queue' 'dm' or 'other'
 * @param decompressedTuple from JSON.parse
 * @returns boolean
 */
function isValidCustomIdTuple(
    decompressedTuple: string[]
): decompressedTuple is CustomIdTuple<ComponentLocation> {
    const lengthMatch = decompressedTuple.length === ExpectedLength;
    // TODO: Check for expected ComponentLocation here
    const isValidType =
        !!decompressedTuple[0] && ['dm', 'queue', 'other'].includes(decompressedTuple[0]);
    const snowflakesAreValid = // snowflakes should only have numbers
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        /^[0-9]+$/.test(decompressedTuple[2]!) && /^[0-9]+$/.test(decompressedTuple[3]!);
    return lengthMatch && isValidType && snowflakesAreValid;
}

/**
 * Decompresses the obfuscated id into CustomIdTuple
 * @param compressedId the id to decompress
 * @returns the original tuple passed into buildComponent
 * @throws CommandParseError or JSONParseError
 */
function decompressComponentId(compressedId: string): CustomIdTuple<ComponentLocation> {
    const rawDecompressed = LZString.decompressFromUTF16(compressedId);
    if (!rawDecompressed) {
        throw new CommandParseError('Invalid Component ID');
    }
    const parsed = JSON.parse(rawDecompressed);
    if (!isValidCustomIdTuple(parsed)) {
        throw new CommandParseError('Invalid Component ID');
    }
    return parsed; // returns CustomIdTuple<'queue'>, CustomIdTuple<'other'>, or CustomIdTuple<'dm'>
    // needs to be manually checked
}

/**
 * Decompresses the component id and extract the component name
 * - this is kind of a duplicate of decompressComponentId but skips the validation step
 * @param compressedId compressed component custom id
 * @returns component name
 */
function extractComponentName(compressedId: string): string {
    const rawDecompressed = LZString.decompressFromUTF16(compressedId);
    if (!rawDecompressed) {
        throw new CommandParseError('Invalid Component ID');
    }
    const parsed = JSON.parse(rawDecompressed);
    return parsed[1];
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
        return Err(new CommandParseError('Cannot decompress this component id'));
    }
    try {
        const parsed = JSON.parse(rawDecompressed);
        if (!isValidCustomIdTuple(parsed)) {
            return Err(new CommandParseError('Invalid Component ID Tuple'));
        }
        return Ok(JSON.parse(rawDecompressed) as CustomIdTuple<T>);
    } catch {
        return Err(new CommandParseError('Failed to parse component JSON'));
    }
}

class YabobButton<T extends ComponentLocation> extends ButtonBuilder {
    constructor(idInfo: CustomIdTuple<T>) {
        super();
        super.setCustomId(LZString.compressToUTF16(JSON.stringify(idInfo)));
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override setCustomId(_: string): this {
        return this;
    }
}

class YabobSelectMenu<T extends ComponentLocation> extends SelectMenuBuilder {
    constructor(idInfo: CustomIdTuple<T>) {
        super();
        super.setCustomId(LZString.compressToUTF16(JSON.stringify(idInfo)));
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override setCustomId(_: string): this {
        return this;
    }
}

class YabobModal<T extends ComponentLocation> extends ModalBuilder {
    constructor(idInfo: CustomIdTuple<T>) {
        super();
        super.setCustomId(LZString.compressToUTF16(JSON.stringify(idInfo)));
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override setCustomId(_: string): this {
        return this;
    }
}

export {
    YabobButton,
    YabobSelectMenu,
    YabobModal,
    buildComponent,
    decompressComponentId,
    safeDecompressComponentId,
    extractComponentName,
    UnknownId
};
