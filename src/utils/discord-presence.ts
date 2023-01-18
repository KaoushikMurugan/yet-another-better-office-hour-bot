import { ActivityType } from 'discord.js';
import { client } from '../global-states.js';
import { green } from './command-line-colors.js';
import { logWithTimeStamp } from './util-functions.js';

// You can't set the presence of a bot to Custom Status, so we can't use the general type of ActivityType
// If you give the presence type of Streaming, it shows up on discord as "Playing" instead of "Streaming"
// So we remove it from the list of types
// Not specifying a type will default to "Playing", so instead we enforce the type to be specified

type StaticBotPresence = {
    type: ActivityType.Playing | ActivityType.Listening | ActivityType.Watching;
    name: string;
};

// prettier replaces the tab between the type and the name with a space
// which isn't pretty at all

// prettier-ignore
const yabobRelatedPresenceList: StaticBotPresence[] = [
    // Bob The Builder
    { type: ActivityType.Watching,  name: 'Bob The Builder' },
    { type: ActivityType.Listening, name: 'Can We Fix It?' },
];

// prettier-ignore
const memePresenceList: StaticBotPresence[] = [
    // Memes
    { type: ActivityType.Listening, name: 'Never Gonna Give You Up' },
    { type: ActivityType.Watching,  name: 'Shrek' },
    { type: ActivityType.Listening, name: 'Crave Rave' },
    { type: ActivityType.Listening, name: 'All Star' },
    { type: ActivityType.Listening, name: 'Dragostea Din Tei' },
    { type: ActivityType.Listening, name: 'HEYYEYAAEYAAAEYAEYAA' },
    { type: ActivityType.Playing,   name: 'Did you know that yabob is a real place?' },
];

// prettier-ignore
const csPresenceList: StaticBotPresence[] = [
    // CS real
    { type: ActivityType.Watching,  name: 'you squash your bugs' },
    { type: ActivityType.Watching,  name: 'you code' },
    { type: ActivityType.Watching,  name: 'Lectures' },
    { type: ActivityType.Watching,  name: 'Midterm Review' },
    { type: ActivityType.Watching,  name: 'Finals Review' },
    { type: ActivityType.Watching,  name: 'Hello World Tutorial' },
    { type: ActivityType.Watching,  name: 'Coding Tutorials' },
    { type: ActivityType.Playing,   name: 'Manifesting an A' },
    { type: ActivityType.Playing,   name: 'gdb' },
    { type: ActivityType.Playing,   name: 'vscode' },
    { type: ActivityType.Playing,   name: 'leetcode' },
    { type: ActivityType.Playing,   name: 'hackerrank' },
    { type: ActivityType.Playing,   name: 'codeforces' },
];

// prettier-ignore
const csMemesPresenceList: StaticBotPresence[] = [
    // CS Memes
    { type: ActivityType.Playing,   name: 'Faster than Internet Explorer' },
    { type: ActivityType.Playing,   name: 'Changing the TV input' },
    { type: ActivityType.Playing,   name: 'Never sudo rm -rf /' },
    { type: ActivityType.Playing,   name: 'ctrl + C, ctrl + V' },
    { type: ActivityType.Playing,   name: 'cmd + C, cmd + V' },
    { type: ActivityType.Watching,  name: 'vim or emacs?' },
    { type: ActivityType.Playing,   name: 'git commit -m "fix"' },
    { type: ActivityType.Playing,   name: '#define true (rand() > 10)' },
    { type: ActivityType.Playing,   name: 'did you mean "XOR" or "OR"?' },
    { type: ActivityType.Playing,   name: "Don't use whitespace in C challenge" },
    { type: ActivityType.Playing,   name: '5 != 120' },
    { type: ActivityType.Playing,   name: '1 + 1 = 10' },
    { type: ActivityType.Playing,   name: "It's not a bug, it's a feature" },
    { type: ActivityType.Playing,   name: 'You probably need a <br>' },
    { type: ActivityType.Playing,   name: 'I can\'t fix code' },
    { type: ActivityType.Playing,   name: 'How do I exit vim?' },
    { type: ActivityType.Playing,   name: 'Requires 0.000025 years of experience to use' },
    { type: ActivityType.Playing,   name: 'StackOverflow' },
    { type: ActivityType.Playing,   name: 'If the compiler knows what\'s wrong, why won\'t it fix it for me?' },
    { type: ActivityType.Playing,   name: 'RECAPTCHA for 10 hours' },
    { type: ActivityType.Playing,   name: 'Watching Lectures at 1.5x' },
    { type: ActivityType.Playing,   name: 'Watching Lectures at 2x' },
    { type: ActivityType.Playing,   name: `exec(s:='print("exec(s:=%r)"%s)')` }, // Quine
];

// prettier-ignore
const helloWorldPresenceList: StaticBotPresence[] = [
    // Hello World in different languages
    { type: ActivityType.Playing,   name: 'printf("Hello World");' }, // c
    { type: ActivityType.Playing,   name: 'System.out.println("Hello World");' }, // java
    { type: ActivityType.Playing,   name: 'print("Hello World")' }, // python
    { type: ActivityType.Playing,   name: 'puts "Hello World"' }, // ruby
    { type: ActivityType.Playing,   name: 'std::cout << "Hello World";' }, // c++
    { type: ActivityType.Playing,   name: 'console.log("Hello World");' }, // javascript
    { type: ActivityType.Playing,   name: 'fmt.Println("Hello World");' }, // go
    { type: ActivityType.Playing,   name: 'println!("Hello World");' }, // rust
    { type: ActivityType.Playing,   name: 'System.Console.WriteLine("Hello World");' }, // C#
    { type: ActivityType.Playing,   name: 'println("Hello World")' }, // swift
    { type: ActivityType.Playing,   name: "writeln ('Hello, world.');" }, // pascal
    { type: ActivityType.Playing,   name: 'echo "Hello World";' }, // php
    { type: ActivityType.Playing,   name: '(print "Hello World")' }, // lisp
    { type: ActivityType.Playing,   name: 'print *, "Hello World"' }, // fortran
    { type: ActivityType.Playing,   name: '10 PRINT "Hello World!"' }, // BASIC
    { type: ActivityType.Playing,   name: 'DISPLAY "Hello World!"' }, // cobol
    { type: ActivityType.Playing,   name: '++++++++++[>+++++++>++++++++++>+++<<<-]>++.>+.+++++++\
..+++.>++.<<+++++++++++++++.>.+++.------.--------.>+.' } // brainf**k
];

/**
 * These presences change over time, so they need to be dynamically created
 */
const dynamicPresenceList: Array<() => StaticBotPresence> = [
    // Number of servers, numGuilds: number
    () => ({
        type: ActivityType.Watching,
        name: `${client.guilds.cache.size} servers`
    })
];

let previousPresence: StaticBotPresence | undefined = undefined;

const presenceTypeMap = new Map<ActivityType, string>([
    [ActivityType.Playing, 'Playing'],
    [ActivityType.Watching, 'Watching'],
    [ActivityType.Listening, 'Listening to']
]);

/**
 * Sets the bot's presence to a random one from the list
 * @remark Consecutive calls to this function will not result in the same presence
 */
function updatePresence(): void {
    let selectedPresenceList: StaticBotPresence[];
    const rand = Math.random(); // guaranteed to be between 0 and 1
    if (rand < 0.05) {
        // 5% chance of yabob related presence
        selectedPresenceList = yabobRelatedPresenceList;
    } else if (rand < 0.2) {
        // 15% chance of meme presence
        selectedPresenceList = memePresenceList;
    } else if (rand < 0.5) {
        // 30% chance of cs presence
        selectedPresenceList = csPresenceList;
    } else if (rand < 0.75) {
        // 25% chance of cs meme presence
        selectedPresenceList = csMemesPresenceList;
    } else if (rand < 0.95) {
        // 20% chance of hello world example presence
        selectedPresenceList = helloWorldPresenceList;
    } else {
        // 5% chance of dynamic presence
        selectedPresenceList = dynamicPresenceList.map(createPresence =>
            createPresence()
        );
    }
    const newPresence = selectedPresenceList.filter(
        botPresence => botPresence !== previousPresence
    )[Math.floor(Math.random() * selectedPresenceList.length)];
    if (newPresence === undefined) {
        // This only happens if the presenceList is empty
        // TS doesn't like that, so we have to check for it
        return;
    }
    client.user.setPresence({
        activities: [newPresence]
    });
    previousPresence = newPresence;
    logWithTimeStamp(
        green('Global'),
        `- Updated presence to ${presenceTypeMap.get(newPresence.type)}: ${
            newPresence.name
        }`
    );
}

export { updatePresence };
