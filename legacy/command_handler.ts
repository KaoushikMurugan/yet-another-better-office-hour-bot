import {
    CategoryChannel,
    CommandInteraction,
    GuildChannel,
    GuildMember,
    GuildMemberRoleManager,
    TextChannel,
    User
} from "discord.js";
import { EmbedColor, SimpleEmbed } from "./embed_helper";
import { AttendingServer } from "./server";
import { UserError } from "./user_action_error";
import AsciiTable from "ascii-table";

export enum CommandAccessLevel {
    ANYONE,
    STAFF,
    ADMIN,
}

interface CommandHandler {
    readonly permission: CommandAccessLevel;
    Process(
        server: AttendingServer,
        interaction: CommandInteraction
    ): Promise<void>;
}

class QueueCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ADMIN;
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "add") {
            const name = interaction.options.getString("queue_name", true);
            await server.CreateQueue(name);
            await interaction.editReply(
                SimpleEmbed(`Created queue "${name}"`, EmbedColor.Success)
            );
        } else if (subcommand === "remove") {
            const channel = interaction.options.getChannel("queue_name", true);
            await server.RemoveQueue(channel as GuildChannel);
            await interaction.editReply(
                SimpleEmbed(
                    `Removed queue "${channel.name}"`,
                    EmbedColor.Success
                )
            );
        } else {
            throw new UserError(`The subcommand ${subcommand} is not valid`);
        }
    }
}

class EnqueueCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ANYONE;
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const channel = interaction.options.getChannel("queue_name", true);
        const user = interaction.options.getMember("user");

        // Workaround for discord bug https://bugs.discord.com/T2703
        // Ensure that a user does not invoke this command with a channel they cannot view.
        if (channel.type === "GUILD_CATEGORY") {
            const unviewable_channel = (
                channel as CategoryChannel
            ).children.find(
                (child) =>
                    !child
                        .permissionsFor(interaction.member as GuildMember)
                        .has("VIEW_CHANNEL")
            );
            if (unviewable_channel !== undefined) {
                throw new UserError(
                    `You do not have access to ${channel.name}`
                );
            }
        }

        if (user instanceof GuildMember) {
            // Sort of a hack, do a permission check for the user option
            const admin_role = (
                interaction.member as GuildMember
            ).roles.cache.find((role) => role.name === "Admin");
            if (admin_role === undefined) {
                await interaction.editReply(
                    SimpleEmbed(
                        `No can do. You don't have access to this command.`,
                        EmbedColor.Error
                    )
                );
            } else {
                await server.EnqueueUser(channel.name, user);
                await interaction.editReply(
                    SimpleEmbed(
                        `<@${user.id}> has been added to "${channel.name}"`,
                        EmbedColor.Success
                    )
                );
            }
        } else {
            await server.EnqueueUser(
                channel.name,
                interaction.member as GuildMember
            );
            await interaction.editReply(
                SimpleEmbed(
                    `You have been added to the ${channel.name} queue.`,
                    EmbedColor.Success
                )
            );
        }
    }
}

class DequeueCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.STAFF;
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const queue_option = interaction.options.getChannel("queue_name");
        const user_option = interaction.options.getUser("user");
        if (user_option !== null && queue_option !== null) {
            throw new UserError(
                'Either "queue_name" or "user" can be provided, not both.'
            );
        }

        if (queue_option !== null && queue_option.type !== "GUILD_CATEGORY") {
            throw new UserError(`${queue_option.name} is not a queue.`);
        }

        const helper = interaction.member as GuildMember;
        if (
            helper.voice.channel === null ||
            helper.voice.channel.type !== "GUILD_VOICE"
        ) {
            throw new UserError("You need to be connected to a voice channel.");
        }

        // Clear any previously set permissions
        await Promise.all(
            helper.voice.channel.permissionOverwrites.cache
                .filter((overwrite) => overwrite.type === "member")
                .map((overwrite) => overwrite.delete())
        );
        const helpee = await server.Dequeue(
            helper,
            queue_option as CategoryChannel,
            user_option as User
        );
        await helper.voice.channel.permissionOverwrites.create(helpee.member, {
            VIEW_CHANNEL: true,
            CONNECT: true,
        });
        const invite = await helper.voice.channel.createInvite();
        let invite_sent = false;
        await helpee.member
            .send(
                SimpleEmbed(
                    `It's your turn! Join the call: ${invite.toString()}`,
                    EmbedColor.Success
                )
            )
            .then(() => {
                invite_sent = true;
            });
        if (invite_sent) {
            await interaction.editReply(
                SimpleEmbed(
                    `<@${helpee.member.user.id}> was sent an invite to your voice channel.`,
                    EmbedColor.Success
                )
            );
        } else {
            console.error(
                `Could not send a message to ${helpee.member.user.username}.`
            );
            await interaction.editReply(
                SimpleEmbed(
                    `I could not send <@${helpee.member.user.id}> an invite to your voice channel. \
            Can you try to get in touch with them?`,
                    EmbedColor.Error
                )
            );
        }
    }
}

class StartCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.STAFF;
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const mute_notif_option =
            interaction.options.getBoolean("mute_notif") === true; //if null, then set to false
        await server.AddHelper(
            interaction.member as GuildMember,
            mute_notif_option
        );
        await interaction.editReply(
            SimpleEmbed(
                "You have started helping. Have fun!",
                EmbedColor.Success
            )
        );
    }
}

class StopCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.STAFF;
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const help_time = await server.RemoveHelper(
            interaction.member as GuildMember
        );
        await interaction.editReply(
            SimpleEmbed(
                `You helped for ${help_time / 60000} minutes. See you later!`,
                EmbedColor.Success
            )
        );
    }
}

class LeaveCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ANYONE;
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const queue_count = await server.RemoveMemberFromAllQueues(
            interaction.member as GuildMember
        );
        if (queue_count === 0) {
            await interaction.editReply(
                SimpleEmbed("You are not in any queues", EmbedColor.Error)
            );
        } else {
            await interaction.editReply(
                SimpleEmbed(
                    `You have been removed from the queue(s)`,
                    EmbedColor.Success
                )
            );
        }
    }
}

class ClearCommandHandler implements CommandHandler {
    permission = CommandAccessLevel.STAFF;
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const channel_option = interaction.options.getChannel("queue_name");
        const all_option = interaction.options.getBoolean("all");

        if (all_option === true) {
            let member_roles = interaction.member?.roles as GuildMemberRoleManager
            if (member_roles.cache.find((role) => role.name === "Admin") === undefined) {
                throw new UserError("Only Admins can clear all queues")
            }
                await server.ClearAllQueues();
            await interaction.editReply(
                SimpleEmbed("All queues have been cleared.", EmbedColor.Success)
            );
        } else if (channel_option instanceof GuildChannel) {
            if (channel_option.type !== "GUILD_CATEGORY") {
                throw new UserError(`${channel_option.name} is not a queue.`);
            }
            let member_roles = interaction.member?.roles as GuildMemberRoleManager
            if (member_roles.cache.find((role) => role.name === "Admin") === undefined) {
                if (!(await server.IsHelperFor(interaction.member as GuildMember, channel_option.name))) {
                    throw new UserError("You can not clear `" + channel_option.name + "` as you are not a helper for it")
                }
            }
            await server.ClearQueue(channel_option as CategoryChannel);
            await interaction.editReply(
                SimpleEmbed(
                    `"${channel_option.name}" has been cleared.`,
                    EmbedColor.Success
                )
            );
        } else {
            throw new UserError(
                'Either "all" or "queue_name" must be provided'
            );
        }
    }
}

class AnnounceCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.STAFF;
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const message_option = interaction.options.getString("message");
        if (message_option === null) {
            throw new UserError("You must provide a message.");
        }

        const queue_option = interaction.options.getChannel("queue_name");
        const [response, successValue] = await server.Announce(
            queue_option as GuildChannel | null,
            message_option,
            interaction.member as GuildMember
        );
        await interaction.editReply(
            SimpleEmbed(
                response,
                successValue ? EmbedColor.Success : EmbedColor.Error
            )
        );
    }
}

class ListHelpersCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ANYONE;
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const helpers = server.GetHelpingMemberStates();
        if (helpers.size === 0) {
            await interaction.editReply(
                SimpleEmbed("No one is helping right now.", 0xff4444)
            );
            return;
        }

        const table = new AsciiTable();
        table.setHeading("Staff Member", "Queues", "Time online");

        helpers.forEach((queues, helper) => {
            const name =
                helper.member.nickname !== null
                    ? helper.member.nickname
                    : helper.member.user.username;
            const help_time = helper.GetHelpTime();
            const mins = String(Math.round(help_time / 60000)).padStart(2, "0");
            const secs = String(
                Math.round((help_time % 60000) / 1000)
            ).padStart(2, "0");
            table.addRow(name, queues.join(", "), `${mins}:${secs}`);
        });
        await interaction.editReply(
            SimpleEmbed("```" + table.toString() + "```", EmbedColor.Success)
        );
    }
}

class ListNextHoursCommandHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ANYONE;
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const queue_option = interaction.options.getChannel("queue_name");
        let queue_name: string;
        if (queue_option === null) {
            const curChannel = interaction.channel as TextChannel;
            if (curChannel.parent === null) {
                throw new UserError(
                    "You can not use this command on this channel. Try specificing a particular \
                course for which you wish to view the upcoming tutoring hours"
                );
            }
            queue_name = curChannel.parent.name;
        } else {
            queue_name = queue_option.name;
        }
        const response = (await server.getUpcomingHoursTable(queue_name))[0];
        await interaction.editReply({
            embeds: [
                {
                    title: "Schedule for " + queue_name,
                    color: EmbedColor.Neutral,
                    description: response,
                    timestamp: new Date(),
                },
            ],
        });
    }
}

class GetNotifcationsHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ANYONE;
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const channel = interaction.options.getChannel("queue_name", true);

        // Workaround for discord bug https://bugs.discord.com/T2703
        // Ensure that a user does not invoke this command with a channel they cannot view.
        if (channel.type === "GUILD_CATEGORY") {
            const unviewable_channel = (
                channel as CategoryChannel
            ).children.find(
                (child) =>
                    !child
                        .permissionsFor(interaction.member as GuildMember)
                        .has("VIEW_CHANNEL")
            );
            if (unviewable_channel !== undefined) {
                throw new UserError(
                    `You do not have access to ${channel.name}`
                );
            }
        }

        await server.JoinNotifications(
            channel.name,
            interaction.member as GuildMember
        );
        await interaction.editReply(
            SimpleEmbed(
                "You will be notified once the `" +
                channel.name +
                "` queue becomes open",
                EmbedColor.Success
            )
        );
    }
}

class RemoveNotifcationsHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ANYONE;
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const channel = interaction.options.getChannel("queue_name", true);

        // Workaround for discord bug https://bugs.discord.com/T2703
        // Ensure that a user does not invoke this command with a channel they cannot view.
        if (channel.type === "GUILD_CATEGORY") {
            const unviewable_channel = (
                channel as CategoryChannel
            ).children.find(
                (child) =>
                    !child
                        .permissionsFor(interaction.member as GuildMember)
                        .has("VIEW_CHANNEL")
            );
            if (unviewable_channel !== undefined) {
                throw new UserError(
                    `You do not have access to ${channel.name}`
                );
            }
        }

        await server.RemoveNotifications(
            channel.name,
            interaction.member as GuildMember
        );
        await interaction.editReply(
            SimpleEmbed(
                "You will no longer be notified once the `" +
                channel.name +
                "` queue \
        becomes open",
                EmbedColor.Success
            )
        );
    }
}

class MsgAfterLeaveVCHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ADMIN;
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "edit") {
            const change_message_option =
                interaction.options.getBoolean("change_message");
            const enable_option = interaction.options.getBoolean("enable");
            if (enable_option === null) {
                throw new UserError(
                    "You must provide a value for the enable option."
                );
            }
            if (interaction === null || interaction.channel === null) {
                return;
            } else if (!interaction.channel.isText()) {
                return;
            }
            let dmMessage: string | null = server.getMsgAfterLeaveVC();
            if (change_message_option === true) {
                await interaction.channel.messages
                    .fetch({ limit: 1 })
                    .then((messages) => {
                        const lastMessage = messages.first();
                        if (lastMessage === undefined) return;
                        if (
                            lastMessage.author.id ===
                            interaction.member?.user.id
                        ) {
                            dmMessage = lastMessage.content;
                        }
                    });
            }
            const response = await server.EditDmMessage(
                dmMessage,
                enable_option
            );
            await interaction.editReply(
                SimpleEmbed(response, EmbedColor.Success)
            );
        } else if (subcommand === "revert") {
            const response = await server.RevertDmMessage();
            await interaction.editReply(
                SimpleEmbed(response, EmbedColor.Success)
            );
        } else {
            throw new UserError(`The subcommand ${subcommand} is not valid`);
        }
    }
}

class SetCalendarHandler implements CommandHandler {
    readonly permission = CommandAccessLevel.ADMIN;
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "set_calendar") {
            let calendar_link = interaction.options.getString("calendar_link");
            if (calendar_link === null) {
                throw new UserError(
                    "You must provide a string for calendar_link."
                );
            }
            if (interaction === null || interaction.channel === null) {
                return;
            } else if (!interaction.channel.isText()) {
                return;
            }

            //https://calendar.google.com/calendar/embed?src=[calendar_id]&[otherstuff]

            const header = "https://calendar.google.com/calendar/embed?src=";
            calendar_link = calendar_link.split("&")[0];
            const posHeader = calendar_link.indexOf(header);
            if (posHeader === 0) {
                const calendar_id = calendar_link.substring(header.length);
                const [response, successValue] = await server.setTutorCalendar(
                    calendar_id
                );
                await interaction.editReply(
                    SimpleEmbed(
                        response,
                        successValue ? EmbedColor.Success : EmbedColor.Error
                    )
                );
            } else {
                await interaction.editReply(
                    SimpleEmbed("Link is invalid", EmbedColor.Error)
                );
            }
        } else if (subcommand === "set_sheets") {
            const sheets_link = interaction.options.getString("sheets_link");
            if (sheets_link === null) {
                throw new UserError(
                    "You must provide a string for sheets_link."
                );
            }
            if (interaction === null || interaction.channel === null) {
                return;
            } else if (!interaction.channel.isText()) {
                return;
            }

            //https://docs.google.com/spreadsheets/d/[doc_id]/edit#gid=[sheet_id]
            //find substring/pos after 'https://docs.google.com/spreadsheets/d/'
            //split by /edit#gid=

            const header = "https://docs.google.com/spreadsheets/d/";
            const gidSep = "/edit#gid=";
            const posHeader = sheets_link.indexOf(header);
            const posGidSep = sheets_link.indexOf(gidSep);
            if (posHeader === 0 && posGidSep > header.length) {
                const doc_id = sheets_link.substring(header.length, posGidSep);
                const sheets_id = sheets_link.substring(
                    posGidSep + gidSep.length
                );
                const [response, successValue] = await server.setTutorSheets(
                    doc_id,
                    sheets_id
                );
                await interaction.editReply(
                    SimpleEmbed(
                        response,
                        successValue ? EmbedColor.Success : EmbedColor.Error
                    )
                );
            } else {
                await interaction.editReply(
                    SimpleEmbed("Link is invalid", EmbedColor.Error)
                );
            }
        } else if (subcommand === "format_help") {
            await interaction.editReply(
                SimpleEmbed(
                    "This command is being worked on. For the time being, please \
            contact the developers of the bot for assitence on how to connect the bot with a calendar and sheets",
                    EmbedColor.Neutral
                )
            );
        } else {
            throw new UserError(`The subcommand ${subcommand} is not valid`);
        }
    }
}

class ForceUpdateQueues implements CommandHandler {
    readonly permission = CommandAccessLevel.ADMIN;
    async Process(server: AttendingServer, interaction: CommandInteraction) {
        console.log;
        await server.ForceUpdateAllQueues();
        await interaction.editReply(
            SimpleEmbed(
                "Successfully updated all the queues",
                EmbedColor.Success
            )
        );
    }
}

const handlers = new Map<string, CommandHandler>([
    ["queue", new QueueCommandHandler()],
    ["enqueue", new EnqueueCommandHandler()],
    ["next", new DequeueCommandHandler()],
    ["start", new StartCommandHandler()],
    ["stop", new StopCommandHandler()],
    ["leave", new LeaveCommandHandler()],
    ["clear", new ClearCommandHandler()],
    ["announce", new AnnounceCommandHandler()],
    ["list_helpers", new ListHelpersCommandHandler()],
    ["when_next", new ListNextHoursCommandHandler()],
    ["notify_me", new GetNotifcationsHandler()],
    ["remove_notif", new RemoveNotifcationsHandler()],
    ["post_session_msg", new MsgAfterLeaveVCHandler()],
    ["calendar", new SetCalendarHandler()],
    ["force_update_queues", new ForceUpdateQueues()],
]);

export async function ProcessCommand(
    server: AttendingServer,
    interaction: CommandInteraction
): Promise<void> {
    try {
        const handler = handlers.get(interaction.commandName);
        if (handler === undefined) {
            await interaction.reply({
                embeds: SimpleEmbed(
                    `The command "${interaction.commandName}" is unrecognized.`,
                    EmbedColor.Error
                ).embeds,
                ephemeral: true,
            });
            console.error(`Recieved an unknown slash-command "${interaction.commandName}" from user "${interaction.user.username}" on \
            server "${interaction.guild?.name}"`);
            return;
        }

        if (!(interaction.member instanceof GuildMember)) {
            await interaction.reply({
                embeds: SimpleEmbed(
                    `Erm. Somethings wrong, this shouldn't happen. I'll inform the humaniod that maintains me`,
                    EmbedColor.Error
                ).embeds,
                ephemeral: true,
            });
            console.error(
                `Recieved an interaction without a member from user ${interaction.user} on server ${interaction.guild}`
            );
            return;
        }
        const admin_role = interaction.member.roles.cache.find(
            (role) => role.name === "Admin"
        );
        const staff_role = interaction.member.roles.cache.find(
            (role) => role.name === "Staff"
        );

        if (
            (handler.permission === CommandAccessLevel.ADMIN &&
                admin_role === undefined) ||
            (handler.permission === CommandAccessLevel.STAFF &&
                staff_role === undefined)
        ) {
            await interaction.reply({
                ...SimpleEmbed(
                    `No can do. You don't have access to this command.`,
                    EmbedColor.Error
                ),
                ephemeral: true,}
            );
            return;
        }

        await interaction.deferReply({ ephemeral: true });
        await handler
            .Process(server, interaction)
            .catch((err: Error) => {
                if (err.name === "UserError") {
                    return interaction.editReply(
                        SimpleEmbed(err.message, EmbedColor.Error)
                    );
                } else {
                    console.error(
                        `Encountered an internal error when processing "${interaction.commandName}" for user "${interaction.user.username}" on server "${interaction.guild?.name}": "${err.stack}"`
                    );
                    return interaction.editReply(
                        SimpleEmbed(
                            "Oh noez! I ran into an internal error.",
                            EmbedColor.Error
                        )
                    );
                }
            })
            .catch((err) => {
                console.error(
                    `An error occurred during error handling: ${err}`
                );
            });
    } catch (err) {
        console.error(`An error occurred during command processing: ${err}`);
    }
}
