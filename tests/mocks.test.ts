import { Client, Guild } from 'discord.js';
import { mock} from 'ts-mockito';

const mockGuild = mock(Guild);
const mockClient = mock(Client);

export { mockGuild, mockClient };
