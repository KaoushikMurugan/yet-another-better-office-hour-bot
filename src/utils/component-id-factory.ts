import {
    TextBasedChannelId,
    GuildId,
    ComponentLocation,
    Optional
} from './type-aliases.js';
import LZString from 'lz-string';
import { ButtonBuilder, ModalBuilder, SelectMenuBuilder } from 'discord.js';

// embed create -> request id -> has cache ? return cache : add to cache
// received interaction -> request deserialization -> has cache ? return cache : add cache

class TwoWayMap<K, V> {
    private reverseMap = new Map<V, K>();
    normalMap = new Map<K, V>();

    /** Gets a value by key, behaves like regular Map.get */
    getByKey(key: K): Optional<V> {
        return this.normalMap.get(key);
    }
    /** Gets a key by value */
    getByValue(val: V): Optional<K> {
        return this.reverseMap.get(val);
    }
    /** Adds a [key, value] entry, behaves like regular Map.set */
    set(key: K, val: V): void {
        this.normalMap.set(key, val);
        this.reverseMap.set(val, key);
    }
    /** Adds a [value, key] entry */
    reverseSet(val: V, key: K): void {
        this.normalMap.set(key, val);
        this.reverseMap.set(val, key);
    }
    /**
     * Deletes a value by key. Behaves like normal Map.delete
     * @param key key to delete
     * @returns boolean, whether the entry exists
     */
    deleteByKey(key: K): boolean {
        const val = this.normalMap.get(key);
        if (val) {
            this.normalMap.delete(key);
            this.reverseMap.delete(val);
            return true;
        }
        return false;
    }
    /**
     * Deletes a key by value
     * @param val
     * @returns
     */
    deleteByValue(val: V): boolean {
        const key = this.reverseMap.get(val);
        if (key) {
            this.normalMap.delete(key);
            this.reverseMap.delete(val);
            return true;
        }
        return false;
    }
    hasKey(key: K): boolean {
        return this.normalMap.has(key);
    }
    hasValue(val: V): boolean {
        return this.reverseMap.has(val);
    }
}

abstract class YabobComponentFactory<
    U extends ButtonBuilder | SelectMenuBuilder | ModalBuilder
> {
    private cache = new TwoWayMap<string, string>();

    compressComponentId<T extends ComponentLocation>(
        type: T,
        componentName: string,
        serverId: T extends 'dm' ? GuildId : undefined,
        channelId: T extends 'other' ? undefined : TextBasedChannelId
    ): string {
        const id = LZString.compressToUTF16(
            // JSON.stringify({
            //     name: componentName,
            //     type: type,
            //     sid: serverId,
            //     cid: channelId
            // })
            JSON.stringify([type, componentName, serverId, channelId])
        );
        return id;
    }

    decompressComponentId(
        compressedId: string
    ): Parameters<typeof this.buildComponent> {
        const rawDecompressed = LZString.decompressFromUTF16(compressedId);
        if (!rawDecompressed) {
            throw Error('Invalid YABOB ID');
        }
        const decompressed = JSON.parse(rawDecompressed);
        decompressed[2] ??= undefined; // JSON.parse returns null
        decompressed[3] ??= undefined;
        console.log(decompressed);
        return decompressed;
    }

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
}

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

export { buttonFactory, selectMenuFactory, modalFactory };
