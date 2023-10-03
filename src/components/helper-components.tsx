import React, { PropsWithChildren } from 'react';

type StringOnlyChildren = { children: string | string[] };

type StyleProps = { [K in 'bold' | 'italics' | 'underline']?: boolean };

/**
 * Makes an element bold
 */
function B({ children }: StringOnlyChildren): JSX.Element {
    return <>**{children}**</>;
}

function H1({ children }: StringOnlyChildren): JSX.Element {
    return (
        <>
            # {children}
            {'\n'}
        </>
    );
}

/**
 * Makes an element italicized
 */
function I({ children }: StringOnlyChildren): JSX.Element {
    return <>*{children}*</>;
}

/**
 * New line
 */
function Br({ repeat }: { repeat?: number }): JSX.Element {
    return <>{'\n'.repeat(repeat ?? 1)}</>;
}

/**
 * The inline code style
 */
function InlineCode({ children }: StringOnlyChildren): JSX.Element {
    return <>`{children}`</>;
}

/**
 * Wrap children in code block
 */
function CodeBlock({ children }: StringOnlyChildren): JSX.Element {
    return (
        <>
            <Br />
            ```{children}```
            <Br />
        </>
    );
}

/**
 * Returns a styled text
 */
function Styled(props: StringOnlyChildren & StyleProps): JSX.Element {
    let prefix = '';
    if (props.bold) {
        prefix += '**';
    }
    if (props.italics) {
        prefix += '*';
    }
    if (props.underline) {
        prefix += '__';
    }
    let suffix = '';
    for (const char of prefix) {
        suffix = char + suffix;
    }
    return <>{`${prefix}${props.children}${suffix}`}</>;
}

/**
 * A markdown link
 */
function MdLink({ href, children }: StringOnlyChildren & { href: string }): JSX.Element {
    return (
        <>
            [{children}]({href})
        </>
    );
}

export { B, I, Br, InlineCode, CodeBlock, MdLink, Styled };
