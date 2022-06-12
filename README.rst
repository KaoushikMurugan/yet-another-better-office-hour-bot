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
      <a href=#quick-start>Quick Start</a> • 
      <a href=https://ecs-oh-bot.github.io/OH-Bot/docs/build/html/index.html>Docs</a> •
      <a href=#license>License</a>
   </p>
.. raw:: html

   </p>

Purpose
-------

We wanted to implement a way to help instructors efficiently automate 
the process of their Office Hours through Discord.

So, we created **BOB**, the **"Better" Office Hours Bot**, with the goal of allowing 
students to effectively communicate with their instructors, with the option to be 
able to ask their peers for help while they wait to ensure they receive the help they need.

Overview
--------

**BOB** is a *server managment automation* bot. This means that **BOB** handles logistical 
tasks like queue management and queue notifications for students.

**BOB** is also a *self-hosted* bot meaning that you will need to host
and maintain your own instance. See `Quick Start <#quick-start>`__ to
get started.

Below is the standard Office Hours (OH) Session Protocol we follow:


**Office Hours (OH) Session Protocol**
**Note**: *Helpers refer to Instructors, TAs, and Tutors.*

#. Helpers open queues that correspond to a course/office hours slot they help for.
#. Students enter the queue of their choice.
#. Helpers issues a dequeue command, which invites a student to join their voice channel.
#. Once their Office Hours session is over, Helpers close their queues.
#. Multiple Helpers can help for the same queue. A Queue will only close if there are no helpers for that queue.

Waiting Queue System
--------------------

**BOB** implements a simple *first come first serve* queue where
student are allowed to enter and leave the queue whenever they like
while OH is being held.

Server Template: **TODO**
------------------------------------------------------

**BOB** makes use of Discord's Server Template feature

There are three roles in the **BOB** server

-  **Admin**: The Admin Role has total control of bot functionality and server interfaces.
-  **Helper**: The Instructor Role allows control over OH sessions and locked channels.
-  **Student**: The Student Role allows for the ability to interface with OH-Queue.

Commands (which Ashley will add changes to later)
-------------------------------------------------

**BOB** commands have access level based on sender roles

**Commands available to everyone:**

-  ``/enqueue [queue_name] (user)`` - Access Role: [Admin, Helper, Student]

   -  Adds sender to the back of the queue ``queue_name``
   -  Option ``user`` : Adds ``user`` to the end of the queue ``queue_name``. Access Role: [Admin, Helper]

-  ``/leave`` - Access Role: [Admin, Helper, Student]

   -  Removes sender from the queue in which they are in

-  ``/list-helpers`` - Access Role: [Admin, Helper, Student]

   -  Shows a list of Helpers that are currently helping, the queues for which they help for and how long it's been since they started helping

-  ``/notify_me [queue_name]`` - Access Role : [Admin, Helper, Student]

   - Adds the member to the notifcation list for a queue. They will be sent a message once the queue they listed for is open

-  ``/remove_notif [queue_name]`` - Access Role : [Admin, Helper, Student]

   - Removes the member from the notification list for a queue

-  ``/when_next [queue_name]`` - Access Role : [Admin, Helper, Student]

   - Lists up to 5 upcoming office hours in the next 7 days listed on the calendar (which is set using `/calendar set_calendar`)

**Commands available to helpers:**

-  ``/start`` - Access Role: [Admin, Helper]

   -  Open queues that the Helper is assigned to help for

-  ``/stop`` - Access Role: [Admin, Helper]

   -  Close the OH-queue, stop students from entering the queue
   -  Students that were in the queue before closing will still be
      regisitered for OH

-  ``/next (queue_name) (user)`` - Access Role: [Admin, Helper]

   -  Removes next student from the sender's queue(s) and sends them 
      an invite to the voice channel.
   -  Option ``queue_name`` : Removes a student from a particular queue
   -  Option ``user`` : Removes a particular user from the queue(s)

-  ``/announce [message] (queue_name)`` - Access Role: [Admin, Helper]

   - Sends a messeage ``message`` to all of the students in the sender's queues
   - Option ``queue_name``: Sends the message to only those in ``queue_name``

-  ``/clear (queue_name) (all)`` - Access Role: [Admin, Helper]

   -  Empties a queue of students
   -  Option ``queue_name`` : Clears only the queue ``queue_name``
   -  Option ``all`` : Clears all queues

**Commands available to admins:**

-  ``/queue add [queue_name]`` - Access Role: [Admin]

   - Creates a new category with the name ``queue_name`` and creates a #queue and #chat text channels within it

-  ``/queue remove [queue_name]`` - Access Role: [Admin]

   - Deletes the category with the name ``queue_name``, if it exists, and the channels within it

-  ``/after_tutor_message edit [enable] (change_message)`` - Access Role : [Admin]

   - Edits the message that's sent to a helpee after their session with a helper is over
   - Option ``enable``: If set to true, will send the message to a helpee after their session. If set to false, doesn't send the message
   - Option ``change_message``: If set to true, grabs the last message, and if sent by the user, sets that message as the new message that BOB will send to the helpee

-  ``/after_tutor_message revert`` - Access Role: [Admin]

   - Reverts the message that BOB sends to helpee to the one it used previously. BOB doesn't not hold more than one previous message at a time.

-  ``/calendar set_calendar [calendar_link]`` - Access Role: [Admin]

   - Sets the calendar for the server that lists the helper's office hours. Must be a public calendar. \
   Read `How to set up when_next <#how-to-set-up-when_next>`__ for more details

-  ``/calendar set_sheets [sheets_link]`` - Access Role: [Admin]

   - Sets the google sheets for the server that lists the Calendar names and their corresponding Discord IDs. Must be a public calendar. \ 
   Read `How to set up when_next <#how-to-set-up-when_next>`__ for more details.

Queue Buttons
-------------

TODO: **(optional suggestion from Ashley)** add gif under each queue button

-  ``Join Queue`` : 
   
   - Adds the person who clicked the button to a queue. 
   - **Note**: *This button’s functionality is similar to the /enqueue command, where the queue to which the person is added is the active category.*

-  ``Leave Queue`` :

   - Removes the person who clicked the button form the queue.
   - **Note**: *This button’s functionality is similar to the /leave command.*

-  ``Notify When Open`` :

   - Adds the person who clicked the button to the notification queue.
   - **Note**: *This button’s functionality is similar to the /notify_me command where the queue is an active category.* 

-  ``Remove Notificatoins`` : 

   - Removes the person who clicked the button from the notification queue.
   - **Note**: *This button’s functionality is similar to the /remove_notif command where the queue is an active category.*

Requirements To Host BOB
------------------------

-  `Git <https://git-scm.com/>`__ (Optional if using packaged release)
-  `Node.js (includes npm) <https://nodejs.org/en/download/>`__ 

-  `Discord <https://discordapp.com/>`__ app & account
-  `Google Cloud ` account, service account & Google Calendar API KEY
-  `Firebase (Google)` Database & associated service account

Quick Start
-----------

1. Create a Discord Server.

2. Follow discord.py `docs <https://discordpy.readthedocs.io/en/latest/discord.html>`__ on creating and adding a bot to your server.

3. Clone the following source code.

.. code:: bash

   git clone https://github.com/ECS-OH-Bot/BOB && cd BOB
   
4. Follow the instructions `here <https://discordpy.readthedocs.io/en/v1.3.3/discord.html#creating-a-bot-account>`__
for obtaining a token for your instance of the Bot.

5. Make a ``.env`` file in the current directory with the following format:

.. code:: 

   BOB_GOOGLE_SHEET_ID=[Insert Google Sheets Token ID here]
   BOB_APP_ID=[Insert Discord Application ID here]
   BOB_BOT_TOKEN=[Insert Discord BOT Token here]
   BOB_GOOGLE_CALENDAR_API_KEY=[Insert Google Calendar API key here]

6. Create a .json file in the current directory named ``gcs_service_account_key.json`` which you get get from the Google Cloud website.

7. Create a .json file in the current directory named ``fbs_service_account_key.json`` which you can get from your Firebase Project -> Settings -> Service account.

8. Run the following command to setup the bot locally.

.. code:: bash

   npm run build

If the build succeeds, run the next command to run the bot.

.. code:: bash

   npm run start

``npm run test`` and ``npm run lint`` are also available. Run ``npm run`` at anytime to view the available npm commands.

9. Adjust the role hierarchy. For security/privacy purposes, bot/scripts are not allowed to adjust themselves upward the role hierarchy. This must be done by hand to allow features of the bot.

.. image:: ./assets/adjustRole.gif

How To Set Up ``when_next``
---------------------------

Setting up the ``when_next`` command requires the following:

-  A **Public Google Calendar** showing the office hours of the Helpers

   -  Each office hour event on the calendar must start with a "calendar name", which is a unique identifier for each Helper. They may use their own names, or something else, but it must be consistent across all their events.
   -  A space must be present after the "calendar name" to seperate it from other text in the event title.

-  A **Google Sheet** that lists "calendar names" and their corresponding discord IDs

   -  The spreadsheet must have the following two columns. The sheet may have other columns, but the titles (i.e. the cells on the first row), must each be unique
     
      -  A column titled "Calendar Name" that lists calendar names for users.
      -  A column titled "Discord ID" that lists the corresponding discord (snowflake) IDs of the calendar name
      **Note**: *Discord ID is NOT your discord username or nickname. Read to know how to get the snowflake ID of a discord user*: <https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID->

   -  The bot must have access to read the Google Sheet. This can be done either by:
     
      -  Setting the Google Sheet to **Public** (i.e. allow anyone with the link can view the document).
      -  If the sheet is private, sending the bot an invite to access the sheet.

`Docs <https://ecs-oh-bot.github.io/OH-Bot/docs/build/html/index.html>`__
=========================================================================

License
-------

Released under the `GNU GPL
v3 <https://www.gnu.org/licenses/gpl-3.0.en.html>`__ license.

``Copyright (C) 2022  Grant Gilson, Noah Rose Ledesma, Stephen Ott, Kaoushik Murugan``
