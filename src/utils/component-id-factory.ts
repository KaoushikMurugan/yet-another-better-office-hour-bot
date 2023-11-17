import { GuildId, ComponentLocation, Optional } from './type-aliases.js';
import LZString from 'lz-string';
import { ButtonBuilder, ModalBuilder, StringSelectMenuBuilder } from 'discord.js';
import { CommandParseError } from './error-types.js';

/** A tuple that represents the information encoded in a custom id */
type CustomIdTuple<T extends ComponentLocation> = [
    type: T,
    componentName: string,
    serverId: GuildId
];

/**
 * This variable is coupled with the type definition of CustomIdTuple
 * - if we ever add more stuff to CustomIdTuple, simply change the value after the equal sign
 * - there will be only 1 possible value
 * - can be extracted as `type TupleLength<T extends unknown[]> = T['length']`
 */
const ExpectedLength: CustomIdTuple<ComponentLocation>['length'] = 3 as const;

/**
 * Wraps over the discord js builder constructor and sets a compressed id
 *  that encodes [type, componentName, serverId, channelId]
 * @param builder builder method that has 'setCustomId'
 * @param idInfo the information to compress into the id
 * @returns the builder that was passed in
 * @example
 * ```ts
 * // type is inferred as buildComponent<'dm', ButtonBuilder>
 * const a = buildComponent(new ButtonBuilder(), ['dm', 'bruh', 'guildId11']);
 * ```
 */
function buildComponent<
    T extends ComponentLocation,
    R extends ButtonBuilder | ModalBuilder | StringSelectMenuBuilder
>(builder: R, idInfo: CustomIdTuple<T>): R {
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
    // TODO: Check for expected ComponentLocation here and constraint return type
    const isValidType =
        !!decompressedTuple[0] && ['dm', 'queue', 'other'].includes(decompressedTuple[0]);
    const snowflakesAreValid = // snowflakes should only have numbers
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        /^[0-9]+$/.test(decompressedTuple[2]!);
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
        throw new CommandParseError('Cannot decompress this component id.');
    }
    const parsed = JSON.parse(rawDecompressed);
    if (!isValidCustomIdTuple(parsed)) {
        throw new CommandParseError('Decompressed id is not a valid custom id tuple.');
    }
    // returns CustomIdTuple<'queue'>, CustomIdTuple<'other'>, or CustomIdTuple<'dm'>
    return parsed;
}

/**
 * Decompresses the component id and extract the component name
 * - this is kind of a duplicate of decompressComponentId but skips the validation step
 * @param compressedId compressed component custom id
 * @param safeExtract if true, return undefined if decompression fails, if false, throw exception
 * @returns component name
 */
function extractComponentName(compressedId: string, safeExtract: true): Optional<string>;
function extractComponentName(compressedId: string, safeExtract: false): string;
function extractComponentName(
    compressedId: string,
    safeExtract: boolean
): Optional<string> {
    const rawDecompressed = LZString.decompressFromUTF16(compressedId);
    if (!rawDecompressed) {
        if (safeExtract) {
            return undefined;
        }
        throw new CommandParseError('Cannot decompress this component id.');
    }
    const parsed = JSON.parse(rawDecompressed);
    return parsed[1];
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

class YabobSelectMenu<T extends ComponentLocation> extends StringSelectMenuBuilder {
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
    extractComponentName
};
