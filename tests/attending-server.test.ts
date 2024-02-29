/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';
import { AttendingServer } from '../src/attending-server/base-attending-server.js';
import { Guild } from 'discord.js';

describe('synchronous passing test', () => {
    // This test passes because it does not throw an exception.
    it('should pass', () => {
        assert.strictEqual(1, 1);
    });

    it('should fail', () => {
        assert.throws(() => {
            AttendingServer.create({} as Guild);
        });
    });
});
