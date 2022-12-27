import { Interaction } from 'discord.js';
import { commandMethodMap2 } from '../command-handling/command/command-handler.js';

// Double dispatch pattern, allows the getHandler function to act like a function factory
async function processChatInputCommand(interaction: Interaction): Promise<void> {
    if (!(interaction.inCachedGuild() && interaction.isChatInputCommand())) {
        return;
    }
    if (!(interaction.commandName in commandMethodMap2)) {
        return;
    }
}

/**
 * Higer order function that abstracts away all the condictionals needed to find the correct handler
 * - getHandler and all the processors use the double dispatch pattern
 * @param interaction
 * @returns
 */
async function getHandler(
    interaction: Interaction
): Promise<(inter: Interaction) => Promise<void>> {
    if (interaction.isChatInputCommand()) {
        return processChatInputCommand;
    }
}


