.. |DiscordLogo| image:: https://img.icons8.com/color/48/000000/discord-logo.png
   :target: https://discordapp.com

|DiscordLogo| BOB
======================================

The "Better" Office Hours Bot
------------------------------

.. raw:: html

   <p align=center style="font-size:large">
      <a href=#purpose>Purpose</a> • 
      <a href=#overview>Overview</a> • 
      <a href=#quickstart>Quick Start</a> • 
      <a href=https://ecs-oh-bot.github.io/OH-Bot/docs/build/html/index.html>Docs</a> •
      <a href=#license>License</a>
   </p>
.. raw:: html

   </p>

Purpose
-------

With the need for online learning becoming increasingly higher,
efficient means of reaching educators has become extremely important. We
implemented a discord bot to help instructors automate the process of
their Office Hours through Discord.

We created this bot with the goal of allowing students to effectively
communicate with their instructors, with the option to be able to ask
their peers for help while they wait.

Overview
--------

**BOB** is a server managment automation bot. This means that tasks
like queue management and notifying students are
handled by **BOB**

**BOB** is a *self-hotsted* bot - meaning that you will need to host
and maintain your own instance. See `Quick Start <#quick-start>`__ to
get started.

The standard OH-Session protocol that we follow: 

- Helpers refer to Instructors, TAs, and Tutors

#. Helpers Opens Queues for which they help for
#. Students enter the queue of their choice
#. Helpers issues a dequeue command
#. Helpers close their queues when their OH-Session is over
#. Multiple Helpers can help for the same queue. A Queue will only
   close if there are no helpers for that queue.

Waiting Queue System
--------------------

**BOB** implements a simple *first come first serve* queue where
student are allowed to enter and leave the queue whenever they like
while OH is being held.

Server Template: **TODO**
------------------------------------------------------

**BOB** makes use of Discord's Server Template feature

There are three roles in the **BOB** server

-  Admin - total control of bot functionality and server interfaces
-  Instructor - control over OH sessions and locked channels
-  Student - ability to interface with OH-Queue

Commands
--------

**BOB** commands have access level based on sender roles

**Commands available to everyone:** [Admin, Helper, Student]

-  ``/enqueue [queue_name] (user)``

   -  Adds sender to the back of the queue ``queue_name``
   -  Option ``user`` : Adds ``user`` to the end of the queue ``queue_name``. Access Role: [Admin, Helper]

-  ``/leave``

   -  Removes sender from the queue in which they are in

-  ``/list-helpers``

   -  Shows a list of Helpers that are currently helping, the queues for which they help for and how long it's been since they started helping

-  ``/notify_me [queue_name]``

   - Adds the member to the notifcation list for a queue. They will be sent a message once the queue they listed for is open

-  ``/remove_notif [queue_name]``

   - Removes the member from the notification list for a queue

-  ``/when_next [queue_name]``

   - Lists up to 5 upcoming office hours in the next 7 days listed on the calendar (which is set using `/calendar set_calendar`)

**Commands available to helpers:** [Admin, Helper]

-  ``/start``

   -  Open queues that the Helper is assigned to help for

-  ``/stop``

   -  Close the OH-queue, stop students from entering the queue
   -  Students that were in the queue before closing will still be
      regisitered for OH

-  ``/next (queue_name) (user)``

   -  Removes next student from the sender's queue(s) and sends them 
      an invite to the voice channel.
   -  Option ``queue_name`` : Removes a student from a particular queue
   -  Option ``user`` : Removes a particular user from the queue(s)

-  ``/announce [message] (queue_name)``

   - Sends a messeage ``message`` to all of the students in the sender's queues
   - Option ``queue_name``: Sends the message to only those in ``queue_name``

-  ``/clear (queue_name) (all)``

   -  Empties a queue of students
   -  Option ``queue_name`` : Clears only the queue ``queue_name``
   -  Option ``all`` : Clears all queues

**Commands available to admins:** [Admin]

-  ``/queue add [queue_name]``

   - Creates a new category with the name ``queue_name`` and creates a #queue and #chat text channels within it

-  ``/queue remove [queue_name]``

   - Deletes the category with the name ``queue_name``, if it exists, and the channels within it

-  ``/after_tutor_message edit [enable] (change_message)``

   - Edits the message that's sent to a helpee after their session with a helper is over
   - Option ``enable``: If set to true, will send the message to a helpee after their session. If set to false, doesn't send the message
   - Option ``change_message``: If set to true, grabs the last message, and if sent by the user, sets that message as the new message that BOB will send to the helpee

-  ``/after_tutor_message revert``

   - Reverts the message that BOB sends to helpee to the one it used previously. BOB doesn't not hold more than one previous message at a time.

-  ``/calendar set_calendar [calendar_link]`` - Access Role: [Admin]

   - Sets the calendar for the server that lists the helper's office hours. Must be a public calendar. \
   Read `How to set up when_next <#how-to-set-up-when_next>`__ for more details

-  ``/calendar set_sheets [sheets_link]`` - Access Role: [Admin]

   - Sets the google sheets for the server that lists the Calendar names and their corresponding Discord IDs. Must be a public calendar. \ 
   Read `How to set up when_next <#how-to-set-up-when_next>`__ for more details.

Queue Buttons
-------------

TODO: add queue buttons gif

-  ``Join Queue`` : 
   
   - Adds the person who clicked the button to the queue. Works like ``/enqueue``, where the queue to which the person is added is the active category

-  ``Leave Queue`` :

   - Removes the person who clicked the button form the queue. Works like ``/leave``

-  ``Notify When Open`` :

   - Adds the person who clicked the button to the notification queue. Works like ``/notify_me``, where the queue is the active category

-  ``Remove Notificatoins`` : 

   - Removes the person who clicked the button from the notification queue. Works like ``/remove_notif``, where the queue is the active category

Requirements
------------

-  `Git <https://git-scm.com/>`__ (Optional if using packaged release)
-  `Node.js (includes npm) <https://nodejs.org/en/download/>`__ 

-  `Discord <https://discordapp.com/>`__ app & account
-  `Google Cloud`__ account, service account & Google Calendar API KEY
-  `Firebase (Google)`__  Firestore Database & assosciated service account

Quick Start
-----------

Instantiate an instance of a server in Discord 


Follow discord.py `docs <https://discordpy.readthedocs.io/en/latest/discord.html>`__ on creating and adding a bot to your server.

Clone the source code

.. code:: bash

   git clone https://github.com/ECS-OH-Bot/BOB && cd BOB

Follow the instructions
`here <https://discordpy.readthedocs.io/en/v1.3.3/discord.html#creating-a-bot-account>`__
for obtaining a token for your instance of the Bot

Make a ``.env`` file in the current directory with the following format:

.. code:: 

   BOB_GOOGLE_SHEET_ID=[Insert Google Sheets Token ID here]
   BOB_APP_ID=[Insert Discord Application ID here]
   BOB_BOT_TOKEN=[Insert Discord BOT Token here]
   BOB_GOOGLE_CALENDAR_API_KEY=[Insert Google Calendar API key here]

Create a .json file in the current directory named ``gcs_service_account_key.json`` which you get get from the Google Cloud website

Create a .json file in the current directory named ``fbs_service_account_key.json`` which you can get from your Firebase Project -> Settings -> Service account

Run the following command to setup the bot locally

.. code:: bash

   npm run build

If the build succeeds, run the next command to run the bot

.. code:: bash

   npm run start

``npm run test`` and ``npm run lint`` are also available. run ``npm run`` at anytime to view the available npm commands

Adjust the role hierarchy.

For security/privacy purposes, bot/scripts are not allowed to adjust themselves upward the role hierarchy. This must be done by hand to allow features of the bot.

.. image:: ./assets/adjustRole.gif

How to set up when_next
-----------------------

For the ``when_next`` command to work, two things are required:

-  A Public Google Calendar shows the office hours of the helpers

   -  The Calendar must be PUBLIC
   -  Each office hour event on the calendar must start with a "calendar name", which is a unique identifier for each Helper. They may use their own names, or something else. But it must be consistant across all their events.
   -  A space must be present after the "calendar name" to seperate it from other text in the event title

-  A Google Sheets that lists "calendar names" and their corresponding discord IDs

   -  The sheets must have the following two columns. The sheet may have other columns, but the titles (i.e. the cells on the first row), must each be unique
     
      -  A column titled "Calendar Name" that lists calendar names for users.
      -  A column titled "Discord ID" that lists the corresponding discord (snowflake) IDs of the calendar name
      Note: Discord ID is NOT your discord username or nickname. Read to know how to get the snowflake ID of a discord user: <https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID->

   -  The bot must have access to read the google sheets. This can be done either by
     
      -  Setting the google sheets to public. i.e. allow anyone with the link can (at least) view the document
      -  If the sheet is private, sending the bot an invite to access the sheet.

`Docs <https://ecs-oh-bot.github.io/OH-Bot/docs/build/html/index.html>`__
=========================================================================

License
-------

Released under the `GNU GPL
v3 <https://www.gnu.org/licenses/gpl-3.0.en.html>`__ license.

``Copyright (C) 2022  Grant Gilson, Noah Rose Ledesma, Stephen Ott, Kaoushik Murugan``
