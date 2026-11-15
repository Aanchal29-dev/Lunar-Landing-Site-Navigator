import test from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch, requestVisibilityAnalysis, requestStressTest, requestMissionWindows, requestComparison } from '../src/backend.js';
import { missionWindow, parseCoordinate, assertAnalysisResponse } from '../src/contracts.js';
import { analysis } from './fixtures.js';

test('coordinate parsing respects hemispheres and rejects partial or contradictory input', () => {
    assert.equal(parseCoordinate('85.2 S', 'latitude', 'N').value, -85.2);
    assert.equal(parseCoordinate('35.5 W', 'longitude', 'E').value, 324.5);
    assert.equal(parseCoordinate('360', 'longitude', 'E').value, 0);
    for (const input of ['1garbage', '1-2', '-85N', '', 'Infinity', '91']) assert.throws(() => parseCoordinate(input, 'latitude', 'N'));
});
test('mission window is explicit UTC and preserves exact whole hours', () => {
    assert.deepEqual(missionWindow('2026-11-20', '00:00', '144'), { start_utc: '2026-11-20T00:00:00Z', duration_hours: 144 });
    for (const hours of ['', 0, 1.5, 337]) assert.throws(() => missionWindow('2026-11-20', '00:00', hours));
    assert.throws(() => missionWindow('2026-02-30', '00:00', 144));
});
test('response validates exact midpoint sampling and strict > 0 horizon', () => {
    const good = analysis(); assertAnalysisResponse(good);
    assert.equal(good.timeline[0].sample_utc, '2026-11-20T00:30:00Z');
    assert.equal(good.timeline[143].sample_utc, '2026-11-25T23:30:00Z');
    const bad = structuredClone(good); bad.timeline[0].earth_visible = true;
    assert.throws(() => assertAnalysisResponse(bad));
    bad.timeline[0].earth_visible = false; bad.timeline[0].sample_utc = good.start_utc;
    assert.throws(() => assertAnalysisResponse(bad));
});
for (const status of [404, 422, 502, 503]) test(`HTTP ${status} is surfaced once without localhost retry`, async t => {
    let count = 0;
    t.mock.method(globalThis, 'fetch', async () => { count++; return new Response(JSON.stringify({ detail: 'Precise API error' }), { status }); });
    await assert.rejects(apiFetch('/api/analyze', { method: 'POST' }), /Precise API error/);
    assert.equal(count, 1);
});
test('HTML returned by a missing proxy is rejected', async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response('<html>frontend</html>'));
    await assert.rejects(apiFetch('/api/missions'), /no JSON/);
});
test('all coordinate endpoints normalize east-positive western longitude', async t => {
    const bodies = [];
    t.mock.method(globalThis, 'fetch', async (_url, options) => { const body = JSON.parse(options.body); bodies.push(body); return Response.json(analysis({ ...body, longitude_deg: -35.5 })); });
    await requestVisibilityAnalysis({ latitude_deg: -85.2, longitude_deg: 324.5, start_utc: '2026-11-20T00:00:00Z' });
    await requestStressTest({ latitude_deg: -85.2, longitude_deg: 324.5, baseline: {}, variant: {} });
    await requestMissionWindows({ latitude_deg: -85.2, longitude_deg: 324.5 });
    await requestComparison({ locations: [{ latitude_deg: -85.2, longitude_deg: 324.5 }] });
    assert.equal(bodies[0].longitude_deg, -35.5); assert.equal(bodies[1].longitude_deg, -35.5); assert.equal(bodies[2].longitude_deg, -35.5); assert.equal(bodies[3].locations[0].longitude_deg, -35.5);
});
test('blank coordinates are rejected before networking', async t => {
    const spy = t.mock.method(globalThis, 'fetch', () => assert.fail('unexpected request'));
    await assert.rejects(requestVisibilityAnalysis({ latitude_deg: '', longitude_deg: 0 }), /Invalid latitude/);
    assert.equal(spy.mock.callCount(), 0);
});
test('caller cancellation reaches fetch without retry', async t => {
    const abort = new AbortController(); abort.abort();
    t.mock.method(globalThis, 'fetch', async (_url, { signal }) => { assert.equal(signal.aborted, true); throw new DOMException('Canceled', 'AbortError'); });
    await assert.rejects(apiFetch('/api/analyze', { signal: abort.signal }), { name: 'AbortError' });
});
