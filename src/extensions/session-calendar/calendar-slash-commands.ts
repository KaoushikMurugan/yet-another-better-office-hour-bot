import { SlashCommandBuilder } from "@discordjs/builders";

const setCalendar = new SlashCommandBuilder()
    .setName("set_calendar")
    .setDescription(
        "Commands to modify the resources connected to the /when_next command"
    )
    .addStringOption((option) =>
        option
            .setName("calendar_id")
            .setDescription("The link to the calendar")
            .setRequired(true)
    );

const whenNext = new SlashCommandBuilder()
    .setName("when_next")
    .setDescription("View the upcoming tutoring hours")
    .addChannelOption((option) =>
        option
            .setName("queue_name")
            .setDescription(
                "The course for which you want to view the next tutoring hours"
            )
            .setRequired(false)
    );

function makeCalendarStringCommand():
    Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup"> {
    const command = new SlashCommandBuilder()
        .setName("make_calendar_string")
        .setDescription("Generates a valid calendar string that can be parsed by YABOB")
        .addStringOption(option => option
            .setRequired(true)
            .setName('your_name')
            .setDescription("Your display name on the calendar"));

    Array(20).fill(undefined).forEach((_, idx) =>
        command.addChannelOption(option =>
            option.setName(`queue_name_${idx + 1}`)
                .setDescription(
                    "The courses you tutor for"
                )
                .setRequired(idx === 0)) // make the first one required
    );
    return command;
}

const makeCalendarStringAll = new SlashCommandBuilder()
    .setName('make_calendar_string_all')
    .setDescription("Generates a valid calendar string for all your approved queues")
    .addStringOption(option => option
        .setRequired(true)
        .setName('your_name')
        .setDescription("Your display name on the calendar"));


const calendarCommands = [
    setCalendar.toJSON(),
    whenNext.toJSON(),
    makeCalendarStringCommand().toJSON(),
    makeCalendarStringAll.toJSON()
];

export { calendarCommands };