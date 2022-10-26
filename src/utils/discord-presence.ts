import { ActivityType } from 'discord.js';
import { client } from '../global-states';
import { cyan, green } from './command-line-colors';

// You can't set the presence of a bot to Custom Status, so we can't use the general type of ActivityType
// If you give the presence type of Streaming, it shows up on discord as "Playing" instead of "Streaming"
// So we remove it from the list of types

type StaticBotPresence = {
    name: string;
    type?: ActivityType.Playing | ActivityType.Listening | ActivityType.Watching;
};

const staticPresenceList: StaticBotPresence[] = [
    // Bob The Builder
    { type: ActivityType.Watching,  name: 'Bob The Builder' },
    { type: ActivityType.Listening, name: 'Can We Fix It?' },
    // Memes
    { type: ActivityType.Listening, name: 'Never Gonna Give You Up' },
    { type: ActivityType.Watching,  name: 'Shrek' },
    { type: ActivityType.Listening, name: 'Crave Rave' },
    { type: ActivityType.Listening, name: 'All Star' },
    { type: ActivityType.Listening, name: 'Dragostea Din Tei' },
    { type: ActivityType.Listening, name: 'HEYYEYAAEYAAAEYAEYAA' },
    { type: ActivityType.Playing,   name: 'Did you know that yabob is a real place?' },
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
    { type: ActivityType.Playing,   name: 'leetcode' },
    { type: ActivityType.Playing,   name: 'hackerrank' },
    { type: ActivityType.Playing,   name: 'codeforces' },
    // CS Memes
    { type: ActivityType.Playing,   name: 'Faster than Internet Explorer' },
    { type: ActivityType.Playing,   name: 'Changing the TV input' },
    { type: ActivityType.Playing,   name: 'Never sudo rm -rf /' },
    { type: ActivityType.Playing,   name: 'crtl + C, ctrl + V' },
    { type: ActivityType.Playing,   name: 'cmd + C, cmd + V' },
    { type: ActivityType.Watching,  name: 'vim or emacs?' },
    { type: ActivityType.Playing,   name: 'git commit -m "fix"' },
    { type: ActivityType.Playing,   name: '#define true (rand() > 10)' },
    { type: ActivityType.Playing,   name: 'did you mean "XOR" or "OR"?' },
    { type: ActivityType.Playing,   name: "Don't use whitespace in C challenge" },
    { type: ActivityType.Playing,   name: '5 ! = 120' },
    { type: ActivityType.Playing,   name: '1 + 1 = 11' },
    { type: ActivityType.Playing,   name: "It's not a bug, it's a feature" },
    { type: ActivityType.Playing,   name: 'You probably need a <br>' },
    { type: ActivityType.Playing,   name: `exec(s:='print("exec(s:=%r)"%s)')` }, // Quine
    // Hello World in different languages
    { type: ActivityType.Playing,   name: 'printf("Hello World");' }, // c
    { type: ActivityType.Playing,   name: 'System.out.println("Hello World");' }, // java
    { type: ActivityType.Playing,   name: 'print("Hello World")' }, // python
    { type: ActivityType.Playing,   name: 'puts "Hello World"' }, // ruby
    { type: ActivityType.Playing,   name: 'cout << "Hello World";' }, // c++
    { type: ActivityType.Playing,   name: 'console.log("Hello World");' }, // javascript
    { type: ActivityType.Playing,   name: 'fmt.Println("Hello World");' }, // go
    { type: ActivityType.Playing,   name: 'println!("Hello World"); // rust' }, // rust
    { type: ActivityType.Playing,   name: 'System.Console.WriteLine("Hello World");' }, // C#
    { type: ActivityType.Playing,   name: 'println("Hello World")' }, // swift
    { type: ActivityType.Playing,   name: "writeln ('Hello, world.');" }, // pascal
    { type: ActivityType.Playing,   name: 'echo "Hello World";' }, // php
    { type: ActivityType.Playing,   name: '(print "Hello World")' }, // lisp
    { type: ActivityType.Playing,   name: 'print *, "Hello World"' }, // fortran
    { type: ActivityType.Playing,   name: '10 PRINT "Hello World!"' }, // BASIC
    { type: ActivityType.Playing,   name: 'DISPLAY "Hello World!"' }, // cobol
    { type: ActivityType.Playing,   name: '++++++++++[>+++++++>++++++++++>+++<<<-]>++.>+.+++++++\
..+++.>++.<<+++++++++++++++.>.+++.------.--------.>+.' }, // brainf**k
    { type: ActivityType.Playing,   name: '(=<`#9]~6ZY327Uv4-QsqpMn&+Ij"\'E%e{Ab~w=_:]\
Kw%o44Uqp0/Q?xNvL:`H%c#DD2^WV>gY;dts76qKJImZkj' } // malbolge
];

/**
 * These presences might depend on the client object
 * so they need to be dynamically created
 * @remark client object should not be referenced as the top level
 */
const dynamicPresenceList: Array<() => StaticBotPresence> = [
    // Number of servers, numGuilds: number
    () => {
        return { type: ActivityType.Watching, name: `${client.guilds.cache.size} servers` };
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
        `[${cyan(
            new Date().toLocaleString('en-US', {
                timeZone: 'PST8PDT'
            })
        )} ` +
            `${green(`Global`)}] Updated presence to ` +
            `${presenceTypeMap.get(newPresence.type)}: ${newPresence.name}`
    );
}

export { updatePresence };
