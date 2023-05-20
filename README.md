<br>
<div align="center">
      <div>
<img width="80%" alt="yet another better office hour bot" src="https://github.com/KaoushikMurugan/yet-another-better-office-hour-bot/assets/60045212/c49faee6-053e-482c-9c52-01549047450a"/>
      </div>
</div>

<div align = "center">
<a href='https://www.gnu.org/licenses/gpl-3.0.en.html' target="_blank"><img alt='' src='https://img.shields.io/badge/GPL_V3-100000?style=for-the-badge&logo=&logoColor=white&labelColor=007acc&color=FE6F6E'/></a>&nbsp&nbsp<a href='https://www.typescriptlang.org/' target="_blank"><img alt='Typescript' src='https://img.shields.io/badge/Typescript-100000?style=for-the-badge&logo=Typescript&logoColor=white&labelColor=007acc&color=007acc'/></a>&nbsp&nbsp<a href='https://nodejs.org/en/' target="_blank"><img alt='Node.js' src='https://img.shields.io/badge/Node.JS_ LTS-100000?style=for-the-badge&logo=Node.js&logoColor=white&labelColor=339933&color=339933'/></a>&nbsp&nbsp<a href='https://discord.gg/p7HS92mHsG' target="_blank"><img alt='Discord' src='https://img.shields.io/badge/Join_our discord-100000?style=for-the-badge&logo=Discord&logoColor=white&labelColor=5865F2&color=5865F2'/></a>
</div>

<div align='center'>
<a href='https://discord.com/api/oauth2/authorize?client_id=967586305959657482&permissions=8&scope=bot' target="_blank"><img alt='' src='https://img.shields.io/badge/invite_yabob to your server!-100000?style=for-the-badge&logo=&logoColor=white&labelColor=ff6188&color=ff6188'/></a>
</div>

<br>

Architecture redesigned by [Zhongning Li (Tommy)](https://github.com/tomli380576).

Based on original **OH-Bot, BOB V2, and BOB V3** created by [Kaoushik Murugan](https://github.com/KaoushikMurugan), [Noah Rose Ledesma](https://github.com/NoahRoseLedesma), [Grant Gilson](https://github.com/GMGilson), and [Stephen Ott](https://github.com/stott531).

<div align="center">
      <span size="+2">
            <a href=#office-hour-protocol><b>Office Hour Protocol</b></a> •
            <a href=https://github.com/KaoushikMurugan/YABOB/wiki><b>User Wiki</b></a> •
            <a href=https://github.com/KaoushikMurugan/yet-another-better-office-hour-bot/wiki/Development-Setup-Guide><b>Developer Documentation</b></a> •
            <a href=#license><b>License</b></a>
      </span>
</div>

# Purpose

We wanted to implement a way to help instructors efficiently automate their office hours through Discord.

So we created **YABOB**, the **Yet Another Better Office-hours Bot**, with the goal of allowing students to effectively communicate with their instructors with the option to be able to ask their peers for help while they wait to ensure they receive the help they need.

# Overview

YABOB is a Discord queue managment automation bot. This means that YABOB handles students joining/leaving a queue as well as staff members pulling a student out of the queue for a session.

YABOB implements a simple first come first serve queue system, where
student are allowed to enter and leave the queue whenever they like
while the office hour session is being held.

Apart from basic queue operations, some of YABOB's other useful features are:

-   Displaying upcoming office hours as listed on a linked google calendar
-   Logging help sessions (who, and how long)
-   Notifying students for the queues they're interested in
-   Automatically clear queues after a specified amount of inactive time

If you would like to host your own YABOB instance, see the [Development Setup Guide](https://github.com/KaoushikMurugan/yet-another-better-office-hour-bot/wiki/Development-Setup-Guide) to get started with running the bot.

# Server Roles

There are three roles that **YABOB** will interact with on your server.

-   **Bot Admin**: The Bot Admin Role has total control of YABOB's functionalities and server interfaces.
-   **Staff**: The Staff Role allows control over OH sessions and locked channels. This role is usually given to Instructors, TAs and Tutors.
-   **Student**: The Student Role allows for the ability to interface with OH-Queue.

# Office Hour Protocol

Below is the standard office hour protocol we follow.

## Staff's Protocol

1. Use the `/start` command to open queues that correspond to the office hour queues they help for.
2. Wait for students to enter the queues of their choice.
3. Use the `/next` command to dequeue a student and send them an invite to join the voice channel.
4. Use the `/stop` command once the office hour session is over.

Multiple staff members can help for the same queue. A queue will close **if and only if** there is no one helping for that queue.

## Student's Protocol

1. Wait for the queue to open
2. Join the queue by clicking on the `Join` button or using the `/enqueue` command.
3. Wait to be pulled out of the queue by a staff member.
4. Once they are pulled out of the queue, they will received a direct message from YABOB with a voice channel link. Click the link to join the voice channel with the staff member.
5. Leave the voice channel at the end of the session.

More commands can be found [here](https://github.com/KaoushikMurugan/yet-another-better-office-hour-bot/wiki/Built-in-Commands) in our [wiki](https://github.com/KaoushikMurugan/yet-another-better-office-hour-bot/wiki).

# License

**Copyright (C) 2022** Zhongning Li, Kaoushik Murugan, Grant Gilson, Noah Rose Ledesma, Stephen Ott

Released under the [GNU GPL v3](https://www.gnu.org/licenses/gpl-3.0.en.html) license.
