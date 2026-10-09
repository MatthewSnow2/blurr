import assert from 'node:assert/strict';
import test from 'node:test';

import { parseTelemetryFile } from '../src/utils/telemetryParser.ts';

test('rejects MP4 instead of synthesizing telemetry', async () => {
  const video = {
    name: 'session.mp4',
    text: async () => '',
  } as unknown as File;

  await assert.rejects(
    parseTelemetryFile(video),
    /Video files do not contain supported telemetry/,
  );
});

test('rejects unknown formats as telemetry', async () => {
  const binary = {
    name: 'session.bin',
    text: async () => '',
  } as unknown as File;

  await assert.rejects(
    parseTelemetryFile(binary),
    /Unsupported telemetry format/,
  );
});
