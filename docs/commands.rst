Commands 
--------

**BOB** commands have access level based on sender roles

**Commands available to everyone:** [Admin, Helper, Student]
============================================================

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
==================================================

-  ``/start (mute_notif)``

   -  Open queues that the Helper (the caller) is assigned to help for
   -  Option ``mute_notif`` : Don't notify users that are enabled notifications for queues assigned to the Helper

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
=========================================

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

-  ``/calendar set_calendar [calendar_link]``

   - Sets the calendar for the server that lists the helper's office hours. Must be a public calendar. \
Read `the /when_next guide <https://github.com/KaoushikMurugan/BOB/blob/main/docs/when_next_guide.rst>`__ for more details.

-  ``/calendar set_sheets [sheets_link]``

   - Sets the google sheets for the server that lists the Calendar names and their corresponding Discord IDs. Must be a public calendar.\
Read `the /when_next guide <https://github.com/KaoushikMurugan/BOB/blob/main/docs/when_next_guide.rst>`__ for more details.

`Go back to docs front page <https://github.com/KaoushikMurugan/BOB/blob/main/docs/main.rst>`__
-----------------------------------------------------------------------------------------------