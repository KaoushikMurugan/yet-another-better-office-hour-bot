Requirements To Host YABOB
------------------------

-  `Git <https://git-scm.com/>`__ (Optional if using packaged release)
-  `Node.js (includes npm) <https://nodejs.org/en/download/>`__ 

-  `Discord <https://discordapp.com/>`__ app & account
-  `Google Cloud` account, service account & Google Calendar API KEY
-  `Firebase (Google)` Firestore Database & associated service account

Quick Start
-----------

1. Create a Discord Server.

2. Follow discord.py `docs <https://discordpy.readthedocs.io/en/latest/discord.html>`__ on creating and adding a bot to your server.

3. Clone the following source code.

.. code:: bash

   git clone https://github.com/KaoushikMurugan/YABOB && cd YABOB
   

4. Follow the instructions `here <https://discordpy.readthedocs.io/en/v1.3.3/discord.html#creating-a-bot-account>`__
for obtaining a token for your instance of the Bot.

5. Make a ``.env`` file in the current directory with the following format:

.. code:: 

   YABOB_GOOGLE_SHEET_ID=[Insert Google Sheets Token ID here]
   YABOB_APP_ID=[Insert Discord Application ID here]
   YABOB_BOT_TOKEN=[Insert Discord BOT Token here]
   YABOB_GOOGLE_CALENDAR_API_KEY=[Insert Google Calendar API key here]

6. Create a .json file in the current directory named ``gcs_service_account_key.json`` which you can get from the Google Cloud website.

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

`Go Back To The Docs Main Page <https://github.com/KaoushikMurugan/YABOB/blob/main/docs/main.rst>`__
-----------------------------------------------------------------------------------------------