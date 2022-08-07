How To Set Up ``when_next``
===========================

Setting up the ``when_next`` command requires the following:

-  A **Public Google Calendar** showing the office hours of the Helpers

   -  Each office hour event on the calendar must start with a "calendar name", which is a unique identifier for each Helper. They may use their own names, or something else, but it must be consistent across all their events.
   -  A space, followed by a hypen, followed by another space. (i.e. " - ") must be present after the "calendar name" to seperate it from other text in the event title.

.. image:: ./assets/calendarExample.png

-  A **Google Sheet** that lists "calendar names" and their corresponding discord IDs

   -  The spreadsheet must have the following two columns. The sheet may have other columns, but the titles (i.e. the cells on the first row), must each be unique
     
      -  A column titled "Calendar Name" that lists calendar names for users.
      -  A column titled "Discord ID" that lists the corresponding discord (snowflake) IDs of the calendar name
      **Note**: *Discord ID is NOT your discord username or nickname. 
      
      *Read* `this <https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID>`__ *to know how to get the snowflake ID of a Discord user.*

.. image:: ./assets/sheetsExample.png

   -  The bot must have access to read the Google Sheet. This can be done either by:
     
      -  Setting the Google Sheet to **Public** (i.e. allow anyone with the link can view the document).
      -  If the sheet is private, sending the bot an invite to access the sheet.

`Go Back To The Docs Main Page <https://github.com/KaoushikMurugan/BOB/blob/main/docs/main.rst>`__
-----------------------------------------------------------------------------------------------