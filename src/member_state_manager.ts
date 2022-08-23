import { HelpQueue } from "./queue";
import { UserError } from "./user_action_error";
import { GuildMember } from "discord.js";

export class MemberState {
    private current_queue: HelpQueue | null = null;
    readonly member: GuildMember;
    private start_helping_timestamp: number | null = null;
    private start_wait_timestamp: number | null = null;
    // if positive, in vc. if null, then left vc and form was sent
    private start_being_helped_timestamp: number | null = null;
    // if just got called through /next, but hasn't entered vc yet
    private up_next: boolean | null = null;
    // A list of the members this user has helped during a single session.
    // Cleared when the user starts helping
    private helped_members: GuildMember[] = [];

    get is_helping(): boolean {
        return this.start_helping_timestamp !== null;
    }

    get is_being_helped(): boolean {
        return this.start_being_helped_timestamp !== null;
    }

    get queue(): HelpQueue | null {
        return this.current_queue;
    }

    get members_helped(): GuildMember[] {
        return this.helped_members;
    }

    /**
     * Check if user can help, set the start time, and clear helped members
     */
    StartHelping(): void {
        if (this.current_queue !== null) {
            throw new UserError("You can't host while in a queue yourself.");
        } else if (this.start_helping_timestamp !== null) {
            throw new UserError("You are already hosting.");
        }
        this.start_helping_timestamp = Date.now();
        this.helped_members = [];
    }

    /**
     * Remove this member from thier helper-queues
     * @returns the time they started helping
     */
    StopHelping(): number {
        if (this.start_helping_timestamp === null) {
            throw new UserError("You are not currently hosting.");
        }
        const start = this.start_helping_timestamp;
        this.start_helping_timestamp = null;
        return start;
    }

    // Used to determine who is next in the queue when multiple queues are available to dequeue from
    /**
     * @returns the time this member has been waiting in queue
     */
    GetWaitTime(): number {
        if (this.current_queue === null || this.start_wait_timestamp === null) {
            console.error(
                `User ${this.member.user.username} is not in a queue. Can't get wait time.`
            );
            return -Infinity;
        }
        return Date.now() - this.start_wait_timestamp;
    }

    /**
     * Add a user to `queue`, and set start of waiting time
     * @param queue
     */
    TryAddToQueue(queue: HelpQueue): void {
        if (this.current_queue !== null) {
            throw new UserError(
                `You are already enqueued in \`${queue.name}\``
            );
        } else if (this.start_helping_timestamp !== null) {
            throw new UserError("You can't join a queue while hosting");
        }
        this.start_wait_timestamp = Date.now();
        this.current_queue = queue;
    }

    /**
     * Remove this member from `queue`, set start_wait to null
     * @param queue
     */
    TryRemoveFromQueue(queue: HelpQueue | null = null): void {
        if (this.current_queue === null) {
            throw new UserError(`You are not in the queue \`${queue?.name}\``);
        }
        if (queue !== null && queue !== this.current_queue) {
            throw new UserError("You are not in the requested queue");
        }
        this.start_wait_timestamp = null;
        this.current_queue = null;
    }

    /**
     * Run when `target` is dequeued from a queue by this member. Adds `target` to the list of members that this member has helped
     * @param target
     */
    OnDequeue(target: GuildMember): void {
        this.helped_members.push(target);
    }

    /**
     * Sets the `up_next` value to `newVal`
     * @param newVal
     */
    SetUpNext(newVal: boolean): void {
        this.up_next = newVal;
    }

    /**
     * @returns the amount of time this member has been helping
     */
    GetHelpTime(): number {
        if (this.start_helping_timestamp === null) {
            console.error(
                `Cannot get help time for ${this.member.user.username}.`
            );
            return 0;
        }
        return Date.now() - this.start_helping_timestamp;
    }

    /**
     * Updates interal values to say that this member has joined a vc for tutoring hours.
     */
    OnJoinVC(): void {
        // if a helper, don't update
        if (this.start_helping_timestamp !== null) return;
        // prevent sending a user this if they accidently join vc and leave
        if (this.up_next !== true) {
            return;
        }
        this.up_next = false;
        this.start_being_helped_timestamp = Date.now();
    }

    /**
     * Updates internal values to say that this member is no longer in a vc. If the user was in vc for tutoring and just left, then send
     * the user in dms `dmMessage` if `dmMessage is not null
     * @param dmMessage
     */
    async OnLeaveVC(dmMessage: string | null): Promise<void> {
        // if a helper, don't update
        if (this.start_being_helped_timestamp === null) return;
        if (dmMessage !== null) {
            await this.member.send(dmMessage);
        }
        this.start_being_helped_timestamp = null;
    }

    constructor(member: GuildMember) {
        this.member = member;
    }
}

export class MemberStateManager {
    private member_map = new Map<GuildMember, MemberState>();

    GetMemberState(member: GuildMember): MemberState {
        let member_state = this.member_map.get(member);
        if (member_state === undefined) {
            member_state = new MemberState(member);
            this.member_map.set(member, member_state);
        }
        return member_state;
    }

    Reset(): void {
        this.member_map = new Map<GuildMember, MemberState>();
    }

    forEach(callback: (member_state: MemberState) => void): void {
        this.member_map.forEach((member_state) => callback(member_state));
    }
}
