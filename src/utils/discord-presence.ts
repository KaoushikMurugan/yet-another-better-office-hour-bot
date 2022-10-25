import { ActivityType } from 'discord.js';
import { client } from '../global-states';

// You can't set the presence of a bot to Custom Status, so we can't use the general type of ActivityType
// If you give the presence type of Streaming, it shows up on discord as "Playing" instead of "Streaming"
// So we remove it from the list of types

type StaticBotPresence = {
    name: string;
    type?: ActivityType.Playing | ActivityType.Listening | ActivityType.Watching;
};

const staticPresenceList: StaticBotPresence[] = [
    // Bob The Builder
    { name: 'Bob The Builder', type: ActivityType.Watching },
    { name: 'Can We Fix It?', type: ActivityType.Listening },
    // Memes
    { name: 'Never Gonna Give You Up', type: ActivityType.Listening },
    { name: 'Shrek', type: ActivityType.Watching },
    { name: 'Crave Rave', type: ActivityType.Listening },
    { name: 'All Star', type: ActivityType.Listening },
    { name: 'Dragostea Din Tei', type: ActivityType.Listening },
    { name: 'HEYYEYAAEYAAAEYAEYAA', type: ActivityType.Listening },
    { name: 'Did you know that yabob is a real place?' },
    // CS real
    { name: 'your bugs disappear', type: ActivityType.Watching },
    { name: 'you squash your bugs', type: ActivityType.Watching },
    { name: 'you code', type: ActivityType.Watching },
    { name: 'Lectures', type: ActivityType.Watching },
    { name: 'Midterm Review', type: ActivityType.Watching },
    { name: 'Finals Review', type: ActivityType.Watching },
    { name: 'Hello World Tutorial', type: ActivityType.Watching },
    { name: 'Coding Tutorials', type: ActivityType.Watching }
];

/**
 * These presences might depend on the client object
 * so they need to be dynamically created
 * @remark client object should not be referenced as the top level
 */
const dynamicPresenceList: Array<() => StaticBotPresence> = [
    // Number of servers, numGuilds: number
    () => {
        return { name: `${client.guilds.cache.size} servers` };
    }
];

let previousPresence: StaticBotPresence | undefined = undefined;

const presenceTypeMap = new Map<ActivityType, string>([
    [ActivityType.Playing, 'Playing'],
    [ActivityType.Watching, 'Watching'],
    [ActivityType.Listening, 'Listening to']
]);

function updatePresence(): void {
    const newPresence = [
        ...dynamicPresenceList.map(presenceFunc => presenceFunc()),
        ...staticPresenceList
    ].filter(botPresence => botPresence !== previousPresence)[
        Math.floor(Math.random() * staticPresenceList.length)
    ];
    if (
        newPresence === undefined ||
        newPresence.name === undefined ||
        newPresence.type === undefined
    ) {
        // This only happens if the presenceList is empty
        // TS doesn't like that, so we have to check for it
        return;
    }
    client.user?.setPresence({
        activities: [newPresence]
    });
    previousPresence = newPresence;
    console.log(
        `Updated presence to ${presenceTypeMap.get(newPresence.type)}: ${
            newPresence.name
        }`
    );
}

export { updatePresence };
