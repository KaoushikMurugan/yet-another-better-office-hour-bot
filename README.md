<div align="center">
      <div>
      
<img width="80%" alt="yet another better office hour bot" src="https://user-images.githubusercontent.com/60045212/198949684-8d4d37d0-72c1-4a24-9304-2675eaa0aa28.svg"/>
      </div>
</div>
<br>

<div align = "center">
<a href='https://www.gnu.org/licenses/gpl-3.0.en.html' target="_blank"><img alt='' src='https://img.shields.io/badge/GPL_V3-100000?style=for-the-badge&logo=&logoColor=white&labelColor=007acc&color=FE6F6E'/></a> <a href='https://www.typescriptlang.org/' target="_blank"><img alt='Typescript' src='https://img.shields.io/badge/Typescript-100000?style=for-the-badge&logo=Typescript&logoColor=white&labelColor=007acc&color=007acc'/></a> <a href='https://nodejs.org/en/' target="_blank"><img alt='Node.js' src='https://img.shields.io/badge/Node.JS_>= 16.17-100000?style=for-the-badge&logo=Node.js&logoColor=white&labelColor=339933&color=339933'/></a> <a href='https://discord.gg/p7HS92mHsG' target="_blank"><img alt='Discord' src='https://img.shields.io/badge/Join_our discord-100000?style=for-the-badge&logo=Discord&logoColor=white&labelColor=5865F2&color=5865F2'/></a>
</div>
<br>

Architecture redesigned by [Zhongning Li (Tommy)](https://github.com/tomli380576).

Based on original **BOB V2** and **BOB V3** created by [Kaoushik Murugan](https://github.com/KaoushikMurugan), [Noah Rose Ledesma](https://github.com/NoahRoseLedesma), [Grant Gilson](https://github.com/GMGilson), and [Stephen Ott](https://github.com/stott531).

<div align="center">
<span size="+2">
      <a href=#purpose>Purpose</a> •
      <a href=#overview>Overview</a> •
      <a href=https://github.com/KaoushikMurugan/YABOB/wiki>Wiki</a> •
      <a href=https://kaoushikmurugan.github.io/yet-another-better-office-hour-bot>Documentation</a> •
      <a href=#license>License</a>
</span>
</div>

# Purpose

We wanted to implement a way to help instructors efficiently automate the process of their Office Hours through Discord.

So, we created **YABOB**, the **Yet Another Better Office-hours Bot**, with the goal of allowing students to effectively communicate with their instructors with the option to be able to ask their peers for help while they wait to ensure they receive the help they need.

# Overview

YABOB is a server managment automation bot. This means that YABOB handles logistical tasks like queue management and queue notifications for students.

YABOB is also a **_self-hosted_** bot meaning that you will need to host
and maintain your own instance.

See the [Setup Guide](https://github.com/KaoushikMurugan/YABOB/wiki/Setup-Guide) to get started with running the bot.

# Office Hours (OH) Session Protocol

Below is the standard Office Hours (OH) Session Protocol we follow:

_Helpers refer to Instructors, TAs, and Tutors._

1. Helpers open queues that correspond to a course/office hours slot they help for.
2. Students enter the queue of their choice.
3. Helpers issues a `/next` command, which invites a student to join their voice channel.
4. Once their Office Hours session is over, Helpers close their queues.
5. Multiple Helpers can help for the same queue. A queue will close if and only if there are no helpers for that queue.

# Waiting Queue System

**YABOB** implements a simple first come first serve queue system where
student are allowed to enter and leave the queue whenever they like
while OH is being held.

There are three roles that **YABOB** will interact with on your server

-   **Bot Admin**: The Bot Admin Role has total control of bot functionality and server interfaces.
-   **Staff**: The Staff\* Role allows control over OH sessions and locked channels.
-   **Student**: The Student Role allows for the ability to interface with OH-Queue.

###### \*Staff is refered to as helper in the code for the bot.

# License

**Copyright (C) 2022** Zhongning Li, Kaoushik Murugan, Grant Gilson, Noah Rose Ledesma, Stephen Ott

Released under the [GNU GPL v3](https://www.gnu.org/licenses/gpl-3.0.en.html) license.
