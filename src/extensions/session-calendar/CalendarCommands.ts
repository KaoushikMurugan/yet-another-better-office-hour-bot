import { EmbedColor } from '../../utils/embed-helper';
import { adminCommandHelpMessages } from '../../../help-channel-messages/AdminCommands';
import { helperCommandHelpMessages } from '../../../help-channel-messages/HelperCommands';
import { studentCommandHelpMessages } from '../../../help-channel-messages/StudentCommands';
import { HelpMessage } from '../../utils/type-aliases';

const setCalendarHelp: HelpMessage = {
  nameValuePair: {
    name: 'set_calendar',
    value: 'set_calendar'
  },
  useInHelpChannel: true,
  useInHelpCommand: true,
  message: {
    embeds: [
      {
        color: EmbedColor.NoColor,
        title: 'Command: `/set_calendar [calendar_id]`',
        fields: [
          {
            name: 'Description',
            value: 'Changes the calendar that YABOB reads from.',
            inline: false
          },
          {
            name: 'Options',
            value:
              "`calendar_id: string`\nGo to that particular calendar's Settings and Sharing tab.\
                Scrolling down will take you do the Integrate Calendar Section. Copy the Calendar ID. It should end with calendar.google.com.",
            inline: true
          },
          {
            name: 'Example Usage',
            value: '`/set_calendar qwerty12345@calendar.google.com`',
            inline: true
          }
        ]
      }
    ]
  }
};

const unsetCalendarHelp: HelpMessage = {
  nameValuePair: {
    name: 'unset_calendar',
    value: 'unset_calendar'
  },
  useInHelpChannel: true,
  useInHelpCommand: true,
  message: {
    embeds: [
      {
        color: EmbedColor.NoColor,
        title: 'Command: `/unset_calendar`',
        fields: [
          {
            name: 'Description',
            value: 'Resets the calendar that YABOB reads from to the default calendar.',
            inline: false
          },
          {
            name: 'Example Usage',
            value: '`/unset_calendar`',
            inline: true
          }
        ]
      }
    ]
  }
};

const makeCalendarStringHelp: HelpMessage = {
  nameValuePair: {
    name: 'make_calendar_string',
    value: 'make_calendar_string'
  },
  useInHelpChannel: true,
  useInHelpCommand: true,
  message: {
    embeds: [
      {
        color: EmbedColor.NoColor,
        title:
          'Command: `/make_calendar_string [displayName] (queue_1) (queue_2) ... (user)`',
        fields: [
          {
            name: 'Description',
            value:
              'Generates a calendar string to put in the event description that the bot will recognize for the queues you specify',
            inline: false
          },
          {
            name: 'Options',
            value:
              '`displayName: string`\nEnter the name you want to show on the calendar. YABOB will map this to your discord id.\n\
                    `queue_i: Channel`\nThe channel(s) you want to tutor for the event\n`user: User`\n\
                    The user you want to change the calendar string for (Bot Admin only)',
            inline: true
          },
          {
            name: 'Example Usage',
            value: '`/make_calendar_string real_name ECS 20 ECS 50`',
            inline: true
          }
        ]
      }
    ]
  }
};

const makeCalendarStringAllHelp: HelpMessage = {
  nameValuePair: {
    name: 'make_calendar_string_all',
    value: 'make_calendar_string_all'
  },
  useInHelpChannel: true,
  useInHelpCommand: true,
  message: {
    embeds: [
      {
        color: EmbedColor.NoColor,
        title: 'Command: `/make_calendar_string_all [displayName]`',
        fields: [
          {
            name: 'Description',
            value:
              'Generates a calendar string to put in the event description that the bot will recognize for all the queues you are approved for.',
            inline: false
          },
          {
            name: 'Options',
            value:
              '`displayName: string`\nEnter the name you want to show on the calendar. YABOB will map this to your discord id.\
                            \n`user: Member`\nThe user you want to change the calendar string for (Bot Admin only)',
            inline: true
          },
          {
            name: 'Example Usage',
            value: '`/make_calendar_string_all Real Name`',
            inline: true
          }
        ]
      }
    ]
  }
};

const whenNextHelp: HelpMessage = {
  nameValuePair: {
    name: 'when_next',
    value: 'when_next'
  },
  useInHelpChannel: true,
  useInHelpCommand: true,
  message: {
    embeds: [
      {
        color: EmbedColor.NoColor,
        title: 'Command: `/when_next`',
        fields: [
          {
            name: 'Description',
            value: 'Shows upcoming help sessions for 1 queue.',
            inline: false
          },
          {
            name: 'Options',
            value:
              '`queue_name: string`\n Specifies a queue to list upcoming help sessions for. If not specified, defauts to current queue if used in a valid queue.',
            inline: true
          },
          {
            name: 'Example Usage',
            value: '`/when_next`\n `/when_next ECS 140A`',
            inline: true
          }
        ]
      }
    ]
  }
};

const calendarAdminHelpMessages: HelpMessage[] = [setCalendarHelp, unsetCalendarHelp];

const calendarHelperHelpMessages: HelpMessage[] = [
  makeCalendarStringHelp,
  makeCalendarStringAllHelp
];

const calendarStudentHelpMessages: HelpMessage[] = [whenNextHelp];

// Prevent repeated pushing for multiple instances
function appendCalendarHelpMessages(sent: boolean): void {
  if (!sent) {
    adminCommandHelpMessages.push(...calendarAdminHelpMessages);
    helperCommandHelpMessages.push(...calendarHelperHelpMessages);
    studentCommandHelpMessages.push(...calendarStudentHelpMessages);
  }
}

export { appendCalendarHelpMessages };
