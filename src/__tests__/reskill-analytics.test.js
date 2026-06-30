import { computeAnalytics } from '../../src-reskill/analytics';
import { fetchLiveAnalytics } from '../../src-reskill/api';

const t = (k) => k;

describe('computeAnalytics — live override', () => {
  const base = { agents: [{ id: 'a1', teamId: 'tm1', skills: {} }], skills: [], selectedTeamIds: [], draft: {}, trendDays: 7, t };

  test('synthesizes trends + KPIs when no live data', () => {
    const a = computeAnalytics({ ...base, live: null });
    expect(a.volumeTrend.length).toBeGreaterThan(0);
    expect(typeof a.slPct).toBe('number');
    expect(typeof a.kpis.occupancyPct).toBe('number');
  });

  test('live trends/SL/KPIs override synthesized values', () => {
    const live = { source: 'live', volumeTrend: [1, 2, 3], ahtTrend: [4, 5], slPct: 88, kpis: { asaSec: 12, abandonPct: 1.1 } };
    const a = computeAnalytics({ ...base, live });
    expect(a.volumeTrend).toEqual([1, 2, 3]);
    expect(a.ahtTrend).toEqual([4, 5]);
    expect(a.slPct).toBe(88);
    expect(a.serviceLevel[0].value).toBe(88);
    expect(a.serviceLevel[1].value).toBe(12);
    expect(a.kpis.asaSec).toBe(12);
    expect(a.kpis.abandonPct).toBe(1.1);
    // metric not supplied by live data keeps its synthesized fallback
    expect(typeof a.kpis.occupancyPct).toBe('number');
  });

  test('partial live data only overrides what it supplies', () => {
    const a = computeAnalytics({ ...base, live: { source: 'live', kpis: { occupancyPct: 73 } } });
    expect(a.kpis.occupancyPct).toBe(73);
    expect(a.volumeTrend.length).toBeGreaterThan(0); // still synthesized
  });
});

describe('fetchLiveAnalytics — Search API parsing', () => {
  const ctx = { isDemo: false, accessToken: 'tok', orgId: 'org-analytics-test', datacenter: 'eu1', trendDays: 7 };

  afterEach(() => { delete global.fetch; });

  test('returns null in demo mode without any network call', async () => {
    global.fetch = jest.fn();
    const res = await fetchLiveAnalytics({ ...ctx, isDemo: true });
    expect(res).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('parses trends, KPIs and occupancy from GraphQL responses', async () => {
    global.fetch = jest.fn((url, opts) => {
      const u = String(url);
      if (u.includes('/team?')) return jsonOk([{ id: 'tm1' }]); // region probe
      const body = String(opts?.body || '');
      if (body.includes('aggregationInterval')) {
        return jsonOk({
          data: { taskDetails: { tasks: [
            { intervalStartTime: 1000, aggregation: [{ name: 'vol', value: 10 }, { name: 'aht', value: 120000 }] },
            { intervalStartTime: 2000, aggregation: [{ name: 'vol', value: 20 }, { name: 'aht', value: 180000 }] },
          ] } },
        });
      }
      if (body.includes('withinSL')) {
        return jsonOk({
          data: { taskDetails: { tasks: [
            { aggregation: [
              { name: 'total', value: 100 }, { name: 'withinSL', value: 80 },
              { name: 'abandoned', value: 5 }, { name: 'asa', value: 24000 },
            ] },
          ] } },
        });
      }
      // occupancy (agentSession)
      return jsonOk({
        data: { agentSession: { agentSessions: [
          { aggregation: [{ name: 'conn', value: 7000 }, { name: 'idle', value: 3000 }] },
        ] } },
      });
    });

    const res = await fetchLiveAnalytics(ctx);
    expect(res.source).toBe('live');
    expect(res.volumeTrend).toEqual([10, 20]);
    expect(res.ahtTrend).toEqual([2, 3]); // ms → minutes
    expect(res.slPct).toBe(80);
    expect(res.kpis.serviceLevel).toBe(80);
    expect(res.kpis.abandonPct).toBe(5);
    expect(res.kpis.asaSec).toBe(24); // ms → seconds
    expect(res.kpis.occupancyPct).toBe(70); // 7000 / (7000+3000)
  });

  test('falls back to null when all Search queries fail', async () => {
    global.fetch = jest.fn((url) => {
      const u = String(url);
      if (u.includes('/team?')) return jsonOk([{ id: 'tm1' }]);
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    });
    const res = await fetchLiveAnalytics({ ...ctx, orgId: 'org-analytics-fail' });
    expect(res).toBeNull();
  });

  test('24h window uses HOURLY interval and team scope injects filters', async () => {
    const bodies = [];
    global.fetch = jest.fn((url, opts) => {
      const u = String(url);
      if (u.includes('/team?')) return jsonOk([{ id: 'tm1' }]);
      bodies.push(JSON.parse(opts.body).query);
      return jsonOk({ data: { taskDetails: { tasks: [] }, agentSession: { agentSessions: [] } } });
    });

    await fetchLiveAnalytics({
      ...ctx, orgId: 'org-analytics-scope', trendDays: 1,
      teamNames: ['Sales "EU"'], teamIds: ['tm-123'],
    });

    const all = bodies.join('\n');
    expect(all).toContain('interval: HOURLY');
    // taskDetails scoped by lastTeam.name (JSON-escaped), ASR scoped by teamId
    expect(all).toContain('lastTeam: { name: { equals: "Sales \\"EU\\"" } }');
    expect(all).toContain('teamId: { equals: "tm-123" }');
  });
});

function jsonOk(payload) {
  return Promise.resolve({ ok: true, status: 200, json: async () => payload });
}
