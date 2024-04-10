/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, it, before } from 'node:test';
import { mockGuild } from './mocks.test.js';
import assert from 'node:assert/strict';
import { when, instance, spy } from 'ts-mockito';
import { AttendingServer } from '../src/attending-server/base-attending-server.js';
import { environment } from '../src/environment/environment-manager.js';

describe('Test to check environment variables', () => {
    before(() => {
        process.env = { ...process.env, OTHER_VAR: 'sghaskjdhk', environment: 'prod' };
    });

    it('should have environment variables', () => {
        assert.ok('OTHER_VAR' in process.env);
        assert.strictEqual(process.env.NODE_ENV, 'development');
        assert.notEqual(process.env.environment, 'dev');
    });

    it('should create an attendingServer correctly', () => {
        when(mockGuild.name).thenReturn('somename');
        const g = instance(mockGuild);
        console.log(g.name);


        const spiedEnv = spy(environment);
        when(spiedEnv.env).thenReturn('development');

        console.log(environment.env);

        // const s = AttendingServer.create(g);
        // console.log(mockGuildInstance.name);
    });
});
