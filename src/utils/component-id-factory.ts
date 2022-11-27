import {
    TextBasedChannelId,
    GuildId,
    Optional,
    YabobComponentId
} from './type-aliases.js';
// import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import LZString from 'lz-string';
import { ButtonBuilder, ModalBuilder, SelectMenuBuilder } from 'discord.js';
import { green, red } from './command-line-colors.js';
import LRU from 'lru-cache';

/** Where the component will appear in discord */
type ComponentLocation = 'dm' | 'queue' | 'other';

/**
 * A map that can be accessed by both the key and value
 */
class TwoWayMap<K, V> {
    private reverseMap = new LRU<V, K>({ max: 100 });
    normalMap = new LRU<K, V>({ max: 100 });

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

// embed create -> request id -> has cache ? return cache : add to cache
// received interaction -> request deserialization -> has cache ? return cache : add cache

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

    compressComponentId<T extends ComponentLocation>(
        type: T,
        componentName: string,
        serverId: T extends 'dm' ? GuildId : undefined,
        channelId: T extends 'other' ? undefined : TextBasedChannelId
    ): string {
        const id = LZString.compressToUTF16(
            JSON.stringify({
                name: componentName,
                type: type,
                sid: serverId,
                cid: channelId
            })
        );
        return id;
    }

    decompressComponentId<T extends ComponentLocation>(
        compressedId: string
    ): Parameters<typeof this.buildComponent> {
        const rawDecompressed = LZString.decompressFromUTF16(compressedId);
        if (!rawDecompressed) {
            throw Error('Invalid YABOB ID');
        }
        const decompressedJSON = JSON.parse(rawDecompressed) as YabobComponentId<T>;
        return [
            decompressedJSON.type,
            decompressedJSON.name,
            decompressedJSON.sid,
            decompressedJSON.cid
        ];
    }
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
