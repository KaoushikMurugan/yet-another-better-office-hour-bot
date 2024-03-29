/** @module Utilities */

import { Optional } from './type-aliases.js';

const ResetColor = '\x1b[0m';

const FgBlack = '\x1b[30m';
const FgRed = '\x1b[31m';
const FgGreen = '\x1b[32m';
const FgYellow = '\x1b[33m';
const FgBlue = '\x1b[34m';
const FgMagenta = '\x1b[35m';
const FgCyan = '\x1b[36m';
const FgWhite = '\x1b[37m';

const BgBlack = '\x1b[40m';
const BgRed = '\x1b[41m';
const BgGreen = '\x1b[42m';
const BgYellow = '\x1b[43m';
const BgBlue = '\x1b[44m';
const BgMagenta = '\x1b[45m';
const BgCyan = '\x1b[46m';
const BgWhite = '\x1b[47m';

/**
 * Util functions to color a given string
 * @param str: string to color
 * @param fgOrBg: color the foreground or the background
 */
function red(str: Optional<string>, fgOrBg: 'Fg' | 'Bg' = 'Fg'): string {
    return `${fgOrBg === 'Fg' ? FgRed : BgRed}${str}${ResetColor}`;
}

function green(str: Optional<string>, fgOrBg: 'Fg' | 'Bg' = 'Fg'): string {
    return `${fgOrBg === 'Fg' ? FgGreen : BgGreen}${str}${ResetColor}`;
}

function yellow(str: Optional<string>, fgOrBg: 'Fg' | 'Bg' = 'Fg'): string {
    return `${fgOrBg === 'Fg' ? FgYellow : BgYellow}${str}${ResetColor}`;
}

function blue(str: Optional<string>, fgOrBg: 'Fg' | 'Bg' = 'Fg'): string {
    return `${fgOrBg === 'Fg' ? FgBlue : BgBlue}${str}${ResetColor}`;
}

function magenta(str: Optional<string>, fgOrBg: 'Fg' | 'Bg' = 'Fg'): string {
    return `${fgOrBg === 'Fg' ? FgMagenta : BgMagenta}${str}${ResetColor}`;
}

function cyan(str: Optional<string>, fgOrBg: 'Fg' | 'Bg' = 'Fg'): string {
    return `${fgOrBg === 'Fg' ? FgCyan : BgCyan}${str}${ResetColor}`;
}

function black(str: Optional<string>, fgOrBg: 'Fg' | 'Bg' = 'Fg'): string {
    return `${fgOrBg === 'Fg' ? FgBlack : BgBlack}${str}${ResetColor}`;
}

function white(str: Optional<string>, fgOrBg: 'Fg' | 'Bg' = 'Fg'): string {
    return `${fgOrBg === 'Fg' ? FgWhite : BgWhite}${str}${ResetColor}`;
}

export { red, green, yellow, blue, magenta, cyan, black, white };
