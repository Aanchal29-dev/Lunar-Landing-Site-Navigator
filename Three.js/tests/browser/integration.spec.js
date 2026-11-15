import { test, expect } from '@playwright/test';
import { analysis, terrain, ice, mission } from '../fixtures.js';

async function mockApi(page) {
    await page.route('**/health', route => route.fulfill({ json: { status: 'ok' } }));
    await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname;
        const body = route.request().postDataJSON();
        if (path === '/api/missions') return route.fulfill({ json: [mission] });
        if (path === '/api/missions/chandrayaan_3') return route.fulfill({ json: mission });
        if (path.endsWith('/replay')) return route.fulfill({ json: { analysis: analysis({ ...mission.actual_location, start_utc: mission.event_time_utc }), historical_context: { location_label: 'Actual landing site', coordinate_quality: 'confirmed' } } });
        if (path === '/api/analyze') return route.fulfill({ json: analysis(body) });
        if (path === '/api/terrain/analyze') return route.fulfill({ json: terrain });
        if (path === '/api/analyze-site') return route.fulfill({ json: ice });
        return route.fulfill({ status: 503, json: { detail: 'Simulated upstream unavailable' } });
    });
}
async function plan(page) {
    await page.goto('/#plan-mission');
    await page.locator('#plan-lat').fill('85.2');
    await page.locator('#btn-plan-hemi-s').click();
    await page.locator('#plan-lon').fill('32.5');
    await page.locator('#plan-date').fill('2026-11-20');
}
test.beforeEach(async ({ page }) => { await mockApi(page); });

test('mission renders 144 exact samples, real terrain fields and source-backed ice absence', async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await plan(page);
    await page.locator('#btn-analyse-landing-site').click();
    await expect(page.locator('#results-content-box')).toBeVisible();
    await expect(page.locator('.timeline-block')).toHaveCount(144);
    await expect(page.locator('#plan-timeline-inspector-text')).toContainText('2026-11-20T00:30:00Z');
    await page.locator('.timeline-block').last().click();
    await expect(page.locator('#plan-timeline-inspector-text')).toContainText('2026-11-25T23:30:00Z');
    await expect(page.locator('#plan-outlook-statement')).toContainText('2026-11-26T00:00:00Z');
    await expect(page.locator('#val-terrain-mean-slope')).toHaveText('3.0 °');
    await expect(page.locator('#val-terrain-max-slope')).toHaveText('8.0 °');
    await expect(page.locator('#val-terrain-coverage')).toContainText('60% requested-area');
    await expect(page.locator('#badge-water-ice')).toHaveText('NO NEARBY REFERENCE');
    expect(errors).toEqual([]);
});
test('NASA error is visible and never replaced with local scientific results', async ({ page }) => {
    let requests = 0;
    await page.route('**/api/analyze', route => { requests++; return route.fulfill({ status: 503, json: { detail: 'NASA is unavailable for this test' } }); });
    await plan(page); await page.locator('#btn-analyse-landing-site').click();
    await expect(page.locator('#plan-form-error')).toContainText('NASA is unavailable for this test');
    await expect(page.locator('#results-content-box')).toBeHidden();
    expect(requests).toBe(1);
});
test('changed input and reset prevent a delayed response replacing current state', async ({ page }) => {
    let release; const gate = new Promise(resolve => { release = resolve; });
    let received; const started = new Promise(resolve => { received = resolve; });
    await page.route('**/api/analyze', async route => { received(); await gate; await route.fulfill({ json: analysis(route.request().postDataJSON()) }).catch(() => {}); });
    await plan(page); await page.locator('#btn-analyse-landing-site').click(); await started;
    await page.locator('#plan-lat').fill('80');
    release();
    await expect(page.locator('#results-idle-state')).toBeVisible();
    await expect(page.locator('#results-content-box')).toBeHidden();
    await expect(page.locator('#btn-analyse-landing-site')).toBeEnabled();
});
test('history uses backend string achievements and replay works', async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/#history');
    await expect(page.locator('#view-history')).toBeVisible();
    await page.locator('.btn-story').first().click();
    await expect(page.locator('#history-detail-modal')).toBeVisible();
    await expect(page.locator('#hmodal-achievements')).toContainText(mission.achievements);
    await expect(page.locator('#hmodal-sources a')).toHaveCount(1);
    await page.locator('#btn-run-replay').click();
    await expect(page.locator('#replay-results-box')).toBeVisible();
    await expect(page.locator('#replay-val-sun')).toHaveText('100.0%');
    expect(errors).toEqual([]);
});
test('history errors show retry and do not substitute hardcoded missions', async ({ page }) => {
    await page.route('**/api/missions', route => route.fulfill({ status: 503, json: { detail: 'Catalogue unavailable' } }));
    await page.goto('/#history');
    await expect(page.locator('#history-missions-grid')).toContainText('Catalogue unavailable');
    await expect(page.locator('.history-card')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
});
test('partial comparison reports unavailable site rather than old results', async ({ page }) => {
    await page.route('**/api/compare', route => {
        const body = route.request().postDataJSON();
        return route.fulfill({ json: { results: [{ label: 'A', status: 'ok', visibility: analysis({ ...body, ...body.locations[0] }) }, { label: 'B', status: 'error', error: 'NASA sample missing' }] } });
    });
    await page.goto('/#comparative-study');
    await page.locator('#btn-run-compare').click();
    await expect(page.locator('#cmp-metric-sun-a')).toHaveText('100%');
    await expect(page.locator('#cmp-metric-sun-b')).toHaveText('Unavailable');
    await expect(page.locator('#cmp-tradeoffs-list')).toContainText('NASA sample missing');
});
test('plan transfers southern coordinate into comparison without losing its sign', async ({ page }) => {
    await plan(page); await page.locator('#btn-analyse-landing-site').click();
    await expect(page.locator('#results-content-box')).toBeVisible();
    await page.locator('#btn-plan-opt-compare').click();
    await expect(page.locator('#cmp-a-lat')).toHaveValue('-85.2');
    await expect(page.locator('#cmp-a-lon')).toHaveValue('32.5');
});
test('invalid navigator text cannot become a partial numeric coordinate', async ({ page }) => {
    await page.goto('/#site-navigator');
    await page.locator('#site-nav-lat').fill('12garbage');
    await page.locator('#site-nav-lon').fill('32');
    await page.locator('#btn-site-nav-submit').click();
    await expect(page.locator('#site-nav-error')).toContainText('valid latitude');
});
