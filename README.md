
<div align="center">

<img width="623" alt="Screen Shot 2022-09-02 at 11 57 04 PM" src="https://user-images.githubusercontent.com/60045212/188259692-156487e9-c198-443c-aa09-c39e80d35046.png">
</div>

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0) [![TypeScript](https://img.shields.io/badge/--3178C6?logo=typescript&logoColor=ffffff)](https://www.typescriptlang.org/) 

Architecture redesigned by [Zhongning Li (Tommy)](https://github.com/tomli380576).

Based on original **BOB V2** and **BOB V3** created by [Kaoushik Murugan](https://github.com/KaoushikMurugan), [Noah Rose Ledesma](https://github.com/NoahRoseLedesma), [Grant Gilson](https://github.com/GMGilson), and [Stephen Ott](https://github.com/stott531).

<div align="center">
<span size="+2">
      <a href=#purpose>Purpose</a> •
      <a href=#overview>Overview</a> •
      <a href=https://github.com/KaoushikMurugan/YABOB/wiki>Wiki & Documentation</a> •
      <a href=#license>License</a>
</span>
</div>

# Purpose

We wanted to implement a way to help instructors efficiently automate the process of their Office Hours through Discord.

So, we created **YABOB**, the **Yet Another Better Office-hours Bot**, with the goal of allowing students to effectively communicate with their instructors with the option to be able to ask their peers for help while they wait to ensure they receive the help they need.

# Overview

YABOB is a server managment automation bot. This means that YABOB handles logistical tasks like queue management and queue notifications for students.

YABOB is also a ***self-hosted*** bot meaning that you will need to host
and maintain your own instance.

See the [Setup Guide](https://github.com/KaoushikMurugan/YABOB/wiki/Setup-Guide) to get started with running the bot.

# Office Hours (OH) Session Protocol

Below is the standard Office Hours (OH) Session Protocol we follow:

*Helpers refer to Instructors, TAs, and Tutors.*

1. Helpers open queues that correspond to a course/office hours slot they help for.
2. Students enter the queue of their choice.
3. Helpers issues a `dequeue` command, which invites a student to join their voice channel.
4. Once their Office Hours session is over, Helpers close their queues.
5. Multiple Helpers can help for the same queue. A queue will close if and only if there are no helpers for that queue.

# Waiting Queue System

**YABOB** implements a simple first come first serve queue system where
student are allowed to enter and leave the queue whenever they like
while OH is being held.

There are three roles in the **YABOB** server

- **Admin**: The Admin Role has total control of bot functionality and server interfaces.
- **Helper**: The Instructor Role allows control over OH sessions and locked channels.
- **Student**: The Student Role allows for the ability to interface with OH-Queue.

# License

**Copyright (C) 2022**  Zhongning Li, Kaoushik Murugan, Grant Gilson, Noah Rose Ledesma, Stephen Ott

Released under the [GNU GPL v3](https://www.gnu.org/licenses/gpl-3.0.en.html) license.
