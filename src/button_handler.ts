import { ButtonInteraction, GuildMember } from "discord.js";
import { AttendingServer } from "./server";

export async function ProcessButtonPress(
    server: AttendingServer,
    interaction: ButtonInteraction
): Promise<void> {
    // TODO: extract interaction as type
    // a space separates the type of interaction and the name of the queue channel
    const pos = interaction.customId.indexOf(" ");
    const type = interaction.customId.substring(0, pos);
    const queue_name = interaction.customId.substring(pos + 1);

    if (!(interaction.member instanceof GuildMember)) {
        console.error(
            `Recieved an interaction without a member from user ${interaction.user} on server ${interaction.guild}`
        );
        return;
    }

    if (type === "join") {
        await interaction.deferUpdate();
        await server
            .EnqueueUser(queue_name, interaction.member)
            .catch(async (errstr: Error) => {
                if (interaction.member instanceof GuildMember) {
                    await interaction.member.send(errstr.message);
                }
            });
    } else if (type === "leave") {
        await interaction.deferUpdate();
        await server
            .RemoveMemberFromQueues(interaction.member)
            .catch(async (errstr: Error) => {
                if (
                    interaction.member instanceof GuildMember &&
                    errstr.name === "UserError"
                ) {
                    await interaction.member.send(errstr.message);
                }
            });
    } else if (type === "notif") {
        await interaction.deferUpdate();
        await server
            .JoinNotifications(queue_name, interaction.member)
            .catch(async (errstr: Error) => {
                if (
                    interaction.member instanceof GuildMember &&
                    errstr.name === "UserError"
                ) {
                    await interaction.member.send(errstr.message);
                }
            });
    } else if (type === "removeN") {
        await interaction.deferUpdate();
        await server
            .RemoveNotifications(queue_name, interaction.member)
            .catch(async (errstr: Error) => {
                if (
                    interaction.member instanceof GuildMember &&
                    errstr.name === "UserError"
                ) {
                    await interaction.member.send(errstr.message);
                }
            });
    } else {
        console.error("Received invalid button interaction");
    }
}
