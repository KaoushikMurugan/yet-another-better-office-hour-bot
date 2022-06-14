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
      <a href=https://github.com/KaoushikMurugan/BOB/blob/main/docs>Docs</a> •
      <a href=#license>License</a>
   </p>
.. raw:: html

   </p>

Purpose
=======

We wanted to implement a way to help instructors efficiently automate 
the process of their Office Hours through Discord.

So, we created **BOB**, the **"Better" Office Hours Bot**, with the goal of allowing 
students to effectively communicate with their instructors with the option to be 
able to ask their peers for help while they wait to ensure they receive the help they need.

Overview
========

**BOB** is a *server managment automation* bot. This means that **BOB** handles logistical 
tasks like queue management and queue notifications for students.

**BOB** is also a *self-hosted* bot meaning that you will need to host
and maintain your own instance. See `Quick Start <https://github.com/KaoushikMurugan/BOB/blob/main/docs/quick_start.rst>`__ to
get started.

Below is the standard Office Hours (OH) Session Protocol we follow:


**Office Hours (OH) Session Protocol**
**Note**: *Helpers refer to Instructors, TAs, and Tutors.*

#. Helpers open queues that correspond to a course/office hours slot they help for.
#. Students enter the queue of their choice.
#. Helpers issues a dequeue command, which invites a student to join their voice channel.
#. Once their Office Hours session is over, Helpers close their queues.
#. Multiple Helpers can help for the same queue. A queue will only close if there are no helpers for that queue.

Waiting Queue System
--------------------

**BOB** implements a simple *first come first serve* queue system where
student are allowed to enter and leave the queue whenever they like
while OH is being held.

Server Template: **TODO**
-------------------------

**BOB** makes use of Discord's Server Template feature

There are three roles in the **BOB** server

-  **Admin**: The Admin Role has total control of bot functionality and server interfaces.
-  **Helper**: The Instructor Role allows control over OH sessions and locked channels.
-  **Student**: The Student Role allows for the ability to interface with OH-Queue.

`Docs <https://github.com/KaoushikMurugan/BOB/blob/main/docs/main.rst>`__
=========================================================================

`Commands <https://github.com/KaoushikMurugan/BOB/blob/main/docs/commands.rst>`__
---------------------------------------------------------------------------------

`Queue Buttons <https://github.com/KaoushikMurugan/BOB/blob/main/docs/queue_buttons.rst>`__
-------------------------------------------------------------------------------------------

`Quick Start <https://github.com/KaoushikMurugan/BOB/blob/main/docs/quick_start.rst>`__
---------------------------------------------------------------------------------------

`/when_next guide <https://github.com/KaoushikMurugan/BOB/blob/main/docs/when_next_guide.rst>`__
------------------------------------------------------------------------------------------------

License
=======

Released under the `GNU GPL v3 <https://www.gnu.org/licenses/gpl-3.0.en.html>`__ license.

``Copyright (C) 2022  Grant Gilson, Noah Rose Ledesma, Stephen Ott, Kaoushik Murugan``
