/**
 * Unit tests for case workflow pure functions
 * Covers: workspace resolution, case normalization, customer fallback,
 *         Redux reducer state transitions, and history merging.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

// Mock fetch globally before importing modules that use it
global.fetch = jest.fn();

const mockJsonResponse = (data, ok = true) => {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    status: ok ? 200 : 404,
  });
};

// ── Imports ───────────────────────────────────────────────────────────────────

const {
  resolveWorkspaceForTaskType,
  normalizeTaskPayload,
  fetchCaseByIdFromTicketDB,
  fetchCasesForCustomerFromTicketDB,
  fetchCaseTaskContext,
  searchCustomerInCustomerDB,
  updateCaseNotesInTicketDB,
  updateCaseStatusInTicketDB,
} = require('../api');

// Import Redux slice directly
const widgetSlice = require('../store/slices/widgetSlice');
const widgetReducer = widgetSlice.default;
const {
  setCaseWorkflowData,
  appendCaseHistoryPage,
  optimisticUpdateCaseData,
  rollbackCaseData,
  updateCaseData,
  clearCaseWorkflow,
  setWidgetConfig,
} = widgetSlice;

// ── resolveWorkspaceForTaskType ───────────────────────────────────────────────

describe('resolveWorkspaceForTaskType', () => {
  test('returns default workspace when task type is NOT in override list', () => {
    const result = resolveWorkspaceForTaskType('email', 'ws-default', 'ws-override', ['case']);
    expect(result).toBe('ws-default');
  });

  test('returns task workspace when task type IS in override list and override is provided', () => {
    const result = resolveWorkspaceForTaskType('case', 'ws-default', 'ws-override', ['case']);
    expect(result).toBe('ws-override');
  });

  test('returns default workspace when override list is empty', () => {
    const result = resolveWorkspaceForTaskType('case', 'ws-default', 'ws-override', []);
    expect(result).toBe('ws-default');
  });

  test('returns default workspace when taskWorkspaceId is null', () => {
    const result = resolveWorkspaceForTaskType('case', 'ws-default', null, ['case']);
    expect(result).toBe('ws-default');
  });

  test('returns default workspace when taskWorkspaceId is undefined', () => {
    const result = resolveWorkspaceForTaskType('case', 'ws-default', undefined, ['case']);
    expect(result).toBe('ws-default');
  });

  test('comparison is case-insensitive for taskType', () => {
    const result = resolveWorkspaceForTaskType('CASE', 'ws-default', 'ws-override', ['case']);
    expect(result).toBe('ws-override');
  });

  test('returns default workspace when all params are null/undefined', () => {
    const result = resolveWorkspaceForTaskType(null, 'ws-default', null, null);
    expect(result).toBe('ws-default');
  });
});

// ── fetchCaseByIdFromTicketDB ─────────────────────────────────────────────────

describe('fetchCaseByIdFromTicketDB', () => {
  beforeEach(() => {
    global.fetch.mockReset();
  });

  test('returns normalized case when ticket DB returns a match', async () => {
    global.fetch.mockResolvedValueOnce(mockJsonResponse([{
      id: '3',
      name: 'INC0003',
      casedescription: 'Cisco Webex Desk Pro Display defekt',
      casestatus: 'open',
      caseuser: 'Peter Hubach',
      caseuseremail: 'phubach@cisco.com',
      casephone: '+49 151 12345678',
      caseowner: 'Marco Pirrone',
      AssetId: 'Asset-phubach',
      createdAt: '2026-04-01T00:00:00.000Z',
      caseappointmentdate: '2026-05-02',
      caseappointmenttime: '09:00',
      Data1: 'First note',
      Data2: '', Data3: '', Data4: '', Data5: '',
    }]));

    const result = await fetchCaseByIdFromTicketDB('INC0003');

    expect(result).not.toBeNull();
    expect(result.caseId).toBe('INC0003');
    expect(result.status).toBe('open');
    expect(result.description).toBe('Cisco Webex Desk Pro Display defekt');
    expect(result.customerEmail).toBe('phubach@cisco.com');
    expect(result.notes).toBe('First note');
    expect(result.source).toBe('ticket-db');
  });

  test('returns null when ticket DB returns empty array', async () => {
    global.fetch.mockResolvedValueOnce(mockJsonResponse([]));
    const result = await fetchCaseByIdFromTicketDB('INC9999');
    expect(result).toBeNull();
  });

  test('returns null when caseId is falsy', async () => {
    const result = await fetchCaseByIdFromTicketDB(null);
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('returns null on network error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await fetchCaseByIdFromTicketDB('INC0003');
    expect(result).toBeNull();
  });

  test('returns null on non-ok HTTP response', async () => {
    global.fetch.mockResolvedValueOnce(mockJsonResponse({}, false));
    const result = await fetchCaseByIdFromTicketDB('INC0003');
    expect(result).toBeNull();
  });
});

// ── searchCustomerInCustomerDB ────────────────────────────────────────────────

describe('searchCustomerInCustomerDB', () => {
  beforeEach(() => {
    global.fetch.mockReset();
  });

  const sampleCustomer = {
    id: '1',
    firstName: 'Peter',
    lastName: 'Hubach',
    email: 'phubach@cisco.com',
    phone: '+491707926745',
    mobile: '+491707926745',
    city: 'Bergen',
    street: 'Örtzestr. 11',
    postalCode: '29303',
    country: 'Germany',
  };

  test('looks up by email first and returns normalized customer', async () => {
    global.fetch.mockResolvedValueOnce(mockJsonResponse([sampleCustomer]));

    const result = await searchCustomerInCustomerDB({ customerEmail: 'phubach@cisco.com' });

    expect(result).not.toBeNull();
    expect(result.email).toBe('phubach@cisco.com');
    expect(result.firstName).toBe('Peter');
    expect(result.source).toBe('customer-db');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain('email=');
  });

  test('falls back to phone lookup when email returns empty', async () => {
    global.fetch
      .mockResolvedValueOnce(mockJsonResponse([]))       // email lookup → empty
      .mockResolvedValueOnce(mockJsonResponse([sampleCustomer])); // phone lookup → hit

    const result = await searchCustomerInCustomerDB({
      customerEmail: 'unknown@example.com',
      customerPhone: '+491707926745',
    });

    expect(result).not.toBeNull();
    expect(result.phone).toBe('+491707926745');
  });

  test('returns null when all lookups return empty', async () => {
    global.fetch.mockResolvedValue(mockJsonResponse([]));

    const result = await searchCustomerInCustomerDB({
      customerEmail: 'noone@example.com',
      customerPhone: '+0000000000',
    });

    expect(result).toBeNull();
  });

  test('returns null when all params are empty/null', async () => {
    const result = await searchCustomerInCustomerDB({});
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ── updateCaseNotesInTicketDB ─────────────────────────────────────────────────

describe('updateCaseNotesInTicketDB', () => {
  beforeEach(() => {
    global.fetch.mockReset();
  });

  test('sends PUT with Data1 field and returns normalized result', async () => {
    global.fetch.mockResolvedValueOnce(mockJsonResponse({
      id: '3', name: 'INC0003', casestatus: 'open', Data1: 'Updated notes',
    }));

    const result = await updateCaseNotesInTicketDB('3', 'Updated notes');

    expect(result).not.toBeNull();
    expect(result.notes).toBe('Updated notes');

    const call = global.fetch.mock.calls[0];
    expect(call[0]).toContain('/3');
    const body = JSON.parse(call[1].body);
    expect(body.Data1).toBe('Updated notes');
    expect(call[1].method).toBe('PUT');
  });

  test('throws when caseRecordId is missing', async () => {
    await expect(updateCaseNotesInTicketDB(null, 'notes')).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('throws on non-ok HTTP response', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('Not found'), status: 404 });
    await expect(updateCaseNotesInTicketDB('99', 'notes')).rejects.toThrow('Failed to update case notes');
  });
});

// ── updateCaseStatusInTicketDB ────────────────────────────────────────────────

describe('updateCaseStatusInTicketDB', () => {
  beforeEach(() => {
    global.fetch.mockReset();
  });

  test('sends PUT with casestatus field', async () => {
    global.fetch.mockResolvedValueOnce(mockJsonResponse({
      id: '3', name: 'INC0003', casestatus: 'closed',
    }));

    const result = await updateCaseStatusInTicketDB('3', 'closed');
    expect(result.status).toBe('closed');

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.casestatus).toBe('closed');
  });

  test('throws when caseRecordId is missing', async () => {
    await expect(updateCaseStatusInTicketDB(undefined, 'closed')).rejects.toThrow();
  });
});

// ── Redux reducer – setCaseWorkflowData ──────────────────────────────────────

describe('Redux: setCaseWorkflowData', () => {
  const baseState = widgetReducer(undefined, { type: '@@INIT' });

  const makeHistory = (n) =>
    Array.from({ length: n }, (_, i) => ({
      id: `h-${i}`,
      source: 'ticket-db',
      interactionType: 'task',
      timestamp: new Date(Date.now() - i * 1000).toISOString(),
      title: `Event ${i}`,
      summary: '',
      details: '',
    }));

  test('populates case, customer, and history', () => {
    const caseData = { id: '3', caseId: 'INC0003', status: 'open', notes: '' };
    const customerData = { id: '1', email: 'p@c.com', enrichmentSource: 'jds' };
    const history = makeHistory(5);

    const next = widgetReducer(baseState, setCaseWorkflowData({
      taskContext: { taskType: 'case' },
      caseData,
      customerData,
      history,
      errors: [],
    }));

    expect(next.caseWorkflow.caseData.caseId).toBe('INC0003');
    expect(next.caseWorkflow.customerData.enrichmentSource).toBe('jds');
    expect(next.caseWorkflow.historyItems).toHaveLength(5);
    expect(next.caseWorkflow.errors).toHaveLength(0);
  });

  test('first page is limited to HISTORY_PAGE_SIZE (15)', () => {
    const history = makeHistory(30);
    const next = widgetReducer(baseState, setCaseWorkflowData({
      taskContext: {}, caseData: null, customerData: null, history, errors: [],
    }));
    expect(next.caseWorkflow.visibleHistory).toHaveLength(15);
    expect(next.caseWorkflow.hasMoreHistory).toBe(true);
    expect(next.caseWorkflow.historyNextOffset).toBe(15);
  });

  test('hasMoreHistory is false when total <= page size', () => {
    const history = makeHistory(10);
    const next = widgetReducer(baseState, setCaseWorkflowData({
      taskContext: {}, caseData: null, customerData: null, history, errors: [],
    }));
    expect(next.caseWorkflow.hasMoreHistory).toBe(false);
    expect(next.caseWorkflow.visibleHistory).toHaveLength(10);
  });
});

// ── Redux reducer – appendCaseHistoryPage ────────────────────────────────────

describe('Redux: appendCaseHistoryPage', () => {
  const makeHistory = (n) =>
    Array.from({ length: n }, (_, i) => ({
      id: `h-${i}`, source: 'ticket-db', interactionType: 'task',
      timestamp: new Date().toISOString(), title: `Event ${i}`, summary: '', details: '',
    }));

  test('loads next page and advances offset', () => {
    const baseState = widgetReducer(undefined, { type: '@@INIT' });
    const history = makeHistory(20);

    const afterLoad = widgetReducer(baseState, setCaseWorkflowData({
      taskContext: {}, caseData: null, customerData: null, history, errors: [],
    }));
    expect(afterLoad.caseWorkflow.visibleHistory).toHaveLength(15);

    const afterMore = widgetReducer(afterLoad, appendCaseHistoryPage());
    expect(afterMore.caseWorkflow.visibleHistory).toHaveLength(20);
    expect(afterMore.caseWorkflow.hasMoreHistory).toBe(false);
    expect(afterMore.caseWorkflow.historyNextOffset).toBe(20);
  });
});

// ── Redux reducer – optimistic update + rollback ──────────────────────────────

describe('Redux: optimistic update and rollback', () => {
  let stateWithCase;

  beforeEach(() => {
    const base = widgetReducer(undefined, { type: '@@INIT' });
    stateWithCase = widgetReducer(base, setCaseWorkflowData({
      taskContext: { taskType: 'case' },
      caseData: { id: '3', caseId: 'INC0003', status: 'open', notes: 'original notes' },
      customerData: null,
      history: [],
      errors: [],
    }));
  });

  test('optimisticUpdateCaseData snapshots previous state and applies patch', () => {
    const next = widgetReducer(stateWithCase, optimisticUpdateCaseData({ notes: 'draft notes' }));
    expect(next.caseWorkflow.caseData.notes).toBe('draft notes');
    expect(next.caseWorkflow.previousCaseData.notes).toBe('original notes');
  });

  test('rollbackCaseData restores previous state', () => {
    const withOptimistic = widgetReducer(stateWithCase, optimisticUpdateCaseData({ notes: 'draft notes' }));
    const rolledBack = widgetReducer(withOptimistic, rollbackCaseData());

    expect(rolledBack.caseWorkflow.caseData.notes).toBe('original notes');
    expect(rolledBack.caseWorkflow.previousCaseData).toBeNull();
  });

  test('updateCaseData confirms the write and clears snapshot', () => {
    const withOptimistic = widgetReducer(stateWithCase, optimisticUpdateCaseData({ notes: 'draft notes' }));
    const confirmed = widgetReducer(withOptimistic, updateCaseData({ notes: 'draft notes', id: '3' }));

    expect(confirmed.caseWorkflow.caseData.notes).toBe('draft notes');
    expect(confirmed.caseWorkflow.previousCaseData).toBeNull();
  });
});

// ── Redux reducer – setWidgetConfig ──────────────────────────────────────────

describe('Redux: setWidgetConfig', () => {
  test('sets workspaceOverrideTaskTypes from config prop', () => {
    const base = widgetReducer(undefined, { type: '@@INIT' });
    const next = widgetReducer(base, setWidgetConfig({ workspaceOverrideTaskTypes: ['case', 'email'] }));

    expect(next.widgetConfig.workspaceOverrideTaskTypes).toEqual(['case', 'email']);
  });

  test('ignores null config gracefully', () => {
    const base = widgetReducer(undefined, { type: '@@INIT' });
    const next = widgetReducer(base, setWidgetConfig(null));

    expect(next.widgetConfig.workspaceOverrideTaskTypes).toEqual(['case']); // default unchanged
  });

  test('merges additional config keys while preserving defaults', () => {
    const base = widgetReducer(undefined, { type: '@@INIT' });
    const next = widgetReducer(base, setWidgetConfig({ futureFlag: true }));

    expect(next.widgetConfig.workspaceOverrideTaskTypes).toEqual(['case']); // default preserved
    expect(next.widgetConfig.futureFlag).toBe(true);
  });
});

// ── Redux reducer – clearCaseWorkflow ─────────────────────────────────────────

describe('Redux: clearCaseWorkflow', () => {
  test('resets case state to initial while preserving page size', () => {
    const base = widgetReducer(undefined, { type: '@@INIT' });
    const withData = widgetReducer(base, setCaseWorkflowData({
      taskContext: { taskType: 'case' },
      caseData: { id: '3', caseId: 'INC0003', status: 'open', notes: '' },
      customerData: { email: 'a@b.com' },
      history: [{ id: 'h1', timestamp: new Date().toISOString() }],
      errors: [],
    }));

    const cleared = widgetReducer(withData, clearCaseWorkflow());
    expect(cleared.caseWorkflow.caseData).toBeNull();
    expect(cleared.caseWorkflow.customerData).toBeNull();
    expect(cleared.caseWorkflow.historyItems).toHaveLength(0);
    expect(cleared.caseWorkflow.historyPageSize).toBe(15); // preserved
  });
});

// ── normalizeTaskPayload ──────────────────────────────────────────────────────

describe('normalizeTaskPayload', () => {
  test('reads taskType from callAssociatedData.taskType.value (CAD)', () => {
    const task = {
      type: 'AgentContact',
      callAssociatedData: {
        taskType: { value: 'case' },
        caseId: { value: 'INC0003' },
      },
    };
    const result = normalizeTaskPayload(task);
    expect(result.taskType).toBe('case');
    expect(result.caseId).toBe('INC0003');
  });

  test('REGRESSION: task.type (event type "AgentContact") is NOT used as taskType', () => {
    // Before the fix this would set taskType to 'agentcontact' and miss the case
    const task = {
      type: 'AgentContact',
      callAssociatedData: {
        taskType: { value: 'case' },
        caseId: { value: 'INC0003' },
      },
    };
    const result = normalizeTaskPayload(task);
    expect(result.taskType).not.toBe('agentcontact');
    expect(result.taskType).toBe('case');
  });

  test('reads taskType from callAssociatedDetails.taskType (flat CAD)', () => {
    const task = {
      type: 'AgentContactAssigned',
      callAssociatedDetails: { taskType: 'case', caseId: 'INC0010' },
    };
    const result = normalizeTaskPayload(task);
    expect(result.taskType).toBe('case');
    expect(result.caseId).toBe('INC0010');
  });

  test('reads taskType from top-level task.taskType', () => {
    const result = normalizeTaskPayload({ taskType: 'Case', type: 'AgentWrapup' });
    expect(result.taskType).toBe('case');
  });

  test('reads taskType from CAD key "Task Type" (with space)', () => {
    const task = {
      callAssociatedData: {
        'Task Type': { value: 'case' },
        caseId: { value: 'INC0042' },
      },
    };
    const result = normalizeTaskPayload(task);
    expect(result.taskType).toBe('case');
  });

  test('reads caseId from CAD "Case ID" key (with space)', () => {
    const task = {
      callAssociatedData: {
        taskType: { value: 'case' },
        'Case ID': { value: 'INC0099' },
      },
    };
    const result = normalizeTaskPayload(task);
    expect(result.caseId).toBe('INC0099');
  });

  test('infers taskType as "case" when caseId is present but taskType is absent', () => {
    const task = { callAssociatedData: { caseId: { value: 'INC0005' } } };
    const result = normalizeTaskPayload(task);
    expect(result.taskType).toBe('case');
    expect(result.caseId).toBe('INC0005');
  });

  test('returns empty taskType when neither taskType source nor caseId is present', () => {
    const result = normalizeTaskPayload({ type: 'AgentContact', id: 'task-1' });
    expect(result.taskType).toBe('');
    expect(result.caseId).toBeNull();
  });

  test('taskType is always lowercased', () => {
    const result = normalizeTaskPayload({ taskType: 'CASE' });
    expect(result.taskType).toBe('case');
  });

  test('returns empty result for empty task', () => {
    const result = normalizeTaskPayload({});
    expect(result.taskType).toBe('');
    expect(result.caseId).toBeNull();
    expect(result.customerEmail).toBeNull();
  });

  test('reads customerEmail and customerPhone from CAD', () => {
    const task = {
      callAssociatedData: {
        taskType: { value: 'case' },
        caseId: { value: 'INC0001' },
        customerEmail: { value: 'user@example.com' },
        ani: { value: '+491700000000' },
      },
    };
    const result = normalizeTaskPayload(task);
    expect(result.customerEmail).toBe('user@example.com');
    expect(result.customerPhone).toBe('+491700000000');
  });
});

// ── fetchCasesForCustomerFromTicketDB ─────────────────────────────────────────

describe('fetchCasesForCustomerFromTicketDB', () => {
  beforeEach(() => {
    global.fetch.mockReset();
  });

  const makeCaseRecord = (id, email, createdAt) => ({
    id: String(id),
    name: `INC00${id}`,
    casedescription: 'Test case',
    casestatus: 'open',
    caseuseremail: email,
    createdAt: createdAt || '2026-01-01T00:00:00.000Z',
  });

  test('queries by email when provided', async () => {
    global.fetch.mockResolvedValueOnce(mockJsonResponse([makeCaseRecord(1, 'a@b.com')]));

    const result = await fetchCasesForCustomerFromTicketDB({ customerEmail: 'a@b.com' });

    expect(result).toHaveLength(1);
    expect(result[0].customerEmail).toBe('a@b.com');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain('caseuseremail=');
  });

  test('queries by phone when provided', async () => {
    global.fetch.mockResolvedValueOnce(mockJsonResponse([makeCaseRecord(2, 'b@c.com')]));

    const result = await fetchCasesForCustomerFromTicketDB({ customerPhone: '+49123' });

    expect(result).toHaveLength(1);
    expect(global.fetch.mock.calls[0][0]).toContain('casephone=');
  });

  test('deduplicates cases returned by multiple queries', async () => {
    const record = makeCaseRecord(1, 'a@b.com');
    global.fetch
      .mockResolvedValueOnce(mockJsonResponse([record]))   // by email
      .mockResolvedValueOnce(mockJsonResponse([record]));  // by phone (same record)

    const result = await fetchCasesForCustomerFromTicketDB({
      customerEmail: 'a@b.com',
      customerPhone: '+49123',
    });

    expect(result).toHaveLength(1);
  });

  test('merges results from email and phone queries', async () => {
    global.fetch
      .mockResolvedValueOnce(mockJsonResponse([makeCaseRecord(1, 'a@b.com', '2026-03-01T00:00:00.000Z')]))
      .mockResolvedValueOnce(mockJsonResponse([makeCaseRecord(2, 'a@b.com', '2026-04-01T00:00:00.000Z')]));

    const result = await fetchCasesForCustomerFromTicketDB({
      customerEmail: 'a@b.com',
      customerPhone: '+49123',
    });

    expect(result).toHaveLength(2);
    // Sorted newest-first
    expect(result[0].caseId).toBe('INC002');
    expect(result[1].caseId).toBe('INC001');
  });

  test('returns empty array when no search params provided', async () => {
    const result = await fetchCasesForCustomerFromTicketDB({});
    expect(result).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('returns empty array on network error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network failure'));
    const result = await fetchCasesForCustomerFromTicketDB({ customerEmail: 'a@b.com' });
    expect(result).toHaveLength(0);
  });

  test('respects limit parameter', async () => {
    const records = Array.from({ length: 10 }, (_, i) => makeCaseRecord(i, 'a@b.com'));
    global.fetch.mockResolvedValueOnce(mockJsonResponse(records));

    const result = await fetchCasesForCustomerFromTicketDB({ customerEmail: 'a@b.com', limit: 3 });
    expect(result).toHaveLength(3);
  });
});

// ── fetchCaseTaskContext ──────────────────────────────────────────────────────

describe('fetchCaseTaskContext', () => {
  beforeEach(() => {
    global.fetch.mockReset();
  });

  const sampleCaseRecord = {
    id: '3',
    name: 'INC0003',
    casedescription: 'Test issue',
    casestatus: 'open',
    caseuser: 'John Doe',
    caseuseremail: 'john@example.com',
    casephone: '+49123',
    caseowner: 'Agent',
    createdAt: '2026-04-01T00:00:00.000Z',
    Data1: 'Some notes',
    Data2: '', Data3: '', Data4: '', Data5: '',
  };

  const sampleCustomer = {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '+49123',
  };

  test('REGRESSION: task.type=AgentContact + CAD caseId + CAD taskType=case → fetches case successfully', async () => {
    global.fetch
      .mockResolvedValueOnce(mockJsonResponse([sampleCaseRecord]))   // ticket DB
      .mockResolvedValueOnce(mockJsonResponse([sampleCustomer]));    // customer DB

    const task = {
      type: 'AgentContact',
      callAssociatedData: {
        taskType: { value: 'case' },
        caseId: { value: 'INC0003' },
      },
    };

    const result = await fetchCaseTaskContext({ task });

    expect(result.errors).not.toContain('unsupported-task-type');
    expect(result.errors).not.toContain('case-not-found');
    expect(result.caseData).not.toBeNull();
    expect(result.caseData.caseId).toBe('INC0003');
    expect(result.taskContext.taskType).toBe('case');
  });

  test('returns unsupported-task-type error when task has no case-related fields', async () => {
    const result = await fetchCaseTaskContext({ task: { type: 'AgentContact', id: 'task-99' } });
    expect(result.errors).toContain('unsupported-task-type');
    expect(result.caseData).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('returns case-not-found error when ticket DB has no matching case', async () => {
    global.fetch.mockResolvedValueOnce(mockJsonResponse([]));   // ticket DB returns empty

    const task = {
      callAssociatedData: {
        taskType: { value: 'case' },
        caseId: { value: 'INC9999' },
      },
    };

    const result = await fetchCaseTaskContext({ task });
    expect(result.errors).toContain('case-not-found');
    expect(result.caseData).toBeNull();
  });

  test('enriches customer from customer DB when no accessToken provided', async () => {
    global.fetch
      .mockResolvedValueOnce(mockJsonResponse([sampleCaseRecord]))   // ticket DB
      .mockResolvedValueOnce(mockJsonResponse([sampleCustomer]));    // customer DB by email

    const task = {
      callAssociatedData: {
        taskType: { value: 'case' },
        caseId: { value: 'INC0003' },
      },
    };

    const result = await fetchCaseTaskContext({ task });

    expect(result.customerData).not.toBeNull();
    expect(result.customerData.email).toBe('john@example.com');
    expect(result.customerData.enrichmentSource).toBe('customer-db');
  });

  test('builds ticket history from case record', async () => {
    global.fetch
      .mockResolvedValueOnce(mockJsonResponse([sampleCaseRecord]))
      .mockResolvedValueOnce(mockJsonResponse([]));                  // customer DB returns empty

    const task = {
      callAssociatedData: {
        taskType: { value: 'case' },
        caseId: { value: 'INC0003' },
      },
    };

    const result = await fetchCaseTaskContext({ task });

    expect(result.history.length).toBeGreaterThan(0);
    expect(result.history[0].source).toBe('ticket-db');
  });

  test('respects historyLimit parameter', async () => {
    global.fetch
      .mockResolvedValueOnce(mockJsonResponse([{ ...sampleCaseRecord, Data1: 'note1' }]))
      .mockResolvedValueOnce(mockJsonResponse([]));

    const task = {
      callAssociatedData: {
        taskType: { value: 'case' },
        caseId: { value: 'INC0003' },
      },
    };

    const result = await fetchCaseTaskContext({ task, historyLimit: 1 });
    expect(result.history.length).toBeLessThanOrEqual(1);
  });
});
