import { Collection } from 'discord.js';
import { AttendingServerV2 } from './attending-server/base-attending-server';
import { GuildId } from './utils/type-aliases';

export const attendingServers: Collection<GuildId, AttendingServerV2> = new Collection();
