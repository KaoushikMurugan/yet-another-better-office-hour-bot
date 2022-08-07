Commands 
--------

**BOB** commands are access level based on roles.

**Commands Available To Everyone (Admin, Helper, Student)**
============================================================

-  ``/enqueue [queue_name] (user)``

   -  **Example:** ``/enqueue ECS32A``
   -  Adds sender to the back of the queue ``queue_name``.
   -  Option ``user`` : Adds ``user`` to the end of the queue typed in``queue_name``. (Access Roles: [Admin, Helper])

-  ``/leave``

   -  **Example:** ``/leave ECS32A``
   -  Removes sender from the queue in which they are in.

-  ``/list-helpers``
   
   -  Shows a list of Helpers that are currently available, the queues for which they help for and how long they've been helping for.

-  ``/notify_me [queue_name]``

   -  **Example:** ``/notify_me ECS32A``
   - Adds a user to the notifcation list for a queue. They will be sent a direct message once the queue they listed is open.

-  ``/remove_notif [queue_name]``

   -  **Example:** ``/remove_notif ECS32A``
   - Removes a user from the notification list for a queue.

-  ``/when_next [queue_name]``

   -  **Example:** ``/when_next ECS32A``
   - Lists up to 5 upcoming office hours in the next 7 days listed on the calendar (which is set using `/calendar set_calendar`).

**Admin & Helper Only Commands** 
==================================================

-  ``/start (mute_notif)``

   -  Open queues that the Helper/Admin is assigned to help for.
   -  Option ``mute_notif`` : Don't notify users that have enabled notifications for queues assigned to a Helper/Admin.

-  ``/stop``

   -  Close the OH-queue and stop students from entering the queue.
   -  Students that were in the queue before closing will still be
      regisitered for OH and be in the queue for the next OH.

-  ``/next (queue_name) (user)``

   -  Removes the next student from a queue and sends them an invite to a voice channel.
   -  Option ``queue_name`` : Removes a student from a particular queue.
   -  Option ``user`` : Removes a specific user from the queue(s).

-  ``/announce [message] (queue_name)``

   - Sends a messeage to all of the students in a queue.
   - Option ``queue_name``: Sends the message to only those in a queue specficied in``queue_name``.

-  ``/clear (queue_name) (all)``

   -  Empties a queue of students.
   -  Option ``queue_name`` : Clears only a specifc queue.
   -  Option ``all`` : Clears all queues.

**Admin-Only Commands** 
=========================================

-  ``/queue add [queue_name]``

   - Creates a new category with the name entered in ``queue_name`` and creates the #queue and #chat text channels within it.

-  ``/queue remove [queue_name]``

   - Deletes an existing category with the name entered in ``queue_name`` and the channels within it.

-  ``/after_tutor_message edit [enable] (change_message)``

   - Edits the message that's sent to a helpee after their session with a Helper is over.
   - Option ``enable``: If set to true, this option will send the message to a student after their session, and does not send the message when set to false.
   - Option ``change_message``: If set to true, this option will take the last message, and if sent by the user, sets that message as the new message that BOB will send to the student.

-  ``/after_tutor_message revert``

   - Reverts the message that BOB sends to a student to the one it used previously. 
   - **Note:** *BOB does not hold more than one previous message at a time.*

-  ``/calendar set_calendar [calendar_link]``

   - Sets the calendar for a server that lists Helper Office Hours.  
   - **Note:** *The calendar used in this command must be a public calendar.*
   *Read* `the /when_next guide <https://github.com/KaoushikMurugan/BOB/blob/main/docs/when_next_guide.rst>`__ *for more details.*

-  ``/calendar set_sheets [sheets_link]``

   - Sets the Google Sheet for a server that lists the Calendar names and their corresponding Discord IDs.\
   - **Note:** *The calendar used in this command must be a public calendar.*
   *Read* `the /when_next guide <https://github.com/KaoushikMurugan/BOB/blob/main/docs/when_next_guide.rst>`__ *for more details.*

`Go Back To The Docs Main Page <https://github.com/KaoushikMurugan/BOB/blob/main/docs/main.rst>`__
-----------------------------------------------------------------------------------------------
