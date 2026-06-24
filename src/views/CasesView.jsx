import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { Badge, Button, Card, CardSection } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import CasesAnalyticsBar from './CasesAnalyticsBar';
import { getMockData } from '../mock/mockData';
import {
  toggleCustomerPanelAndLoadCases,
  toggleRelatedCaseExpanded,
  openRelatedCasePage,
} from '../store';
import { toggleAnalyticsOpen } from '../store/slices/widgetSlice';

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
};

const statusColor = (status) => {
  const v = String(status || '').toLowerCase();
  if (v === 'closed' || v === 'resolved') return 'green';
  if (v === 'in progress' || v === 'inprogress') return 'blue';
  return 'orange';
};

// ─── Analytics computation from case list ────────────────────────────────

const STATUS_COLORS    = { 'open': '#f5a623', 'in-progress': '#00a0d1', 'resolved': '#4ade80', 'closed': '#9ca3af' };
const PRIORITY_COLORS  = { critical: '#e8453c', high: '#f5a623', medium: '#00a0d1', low: '#9ca3af' };
const CATEGORY_COLORS  = { payment: '#a78bfa', account: '#60a5fa', technical: '#34d399', fraud: '#e8453c', lending: '#f472b6', general: '#9ca3af' };
const STATUS_ORDER     = ['open', 'in-progress', 'resolved', 'closed'];
const PRIORITY_ORDER   = ['critical', 'high', 'medium', 'low'];
const CATEGORY_ORDER   = ['payment', 'account', 'technical', 'fraud', 'lending', 'general'];

const computeCasesAnalytics = (cases, t) => {
  const statusCount = {};
  const priorityCount = {};
  const categoryCount = {};
  cases.forEach((c) => {
    const sk = (c.status || 'open').toLowerCase().replace(/\s+/g, '-');
    statusCount[sk] = (statusCount[sk] || 0) + 1;
    const pk = (c.priority || 'medium').toLowerCase();
    priorityCount[pk] = (priorityCount[pk] || 0) + 1;
    const ck = (c.category || 'general').toLowerCase();
    categoryCount[ck] = (categoryCount[ck] || 0) + 1;
  });

  const byStatus = STATUS_ORDER
    .filter((k) => statusCount[k] > 0)
    .map((k) => ({
      key: k,
      label: t(`analytics.statusLabels.${k}`) || k.charAt(0).toUpperCase() + k.slice(1).replace('-', ' '),
      value: statusCount[k],
      color: STATUS_COLORS[k] || '#9ca3af',
    }));

  const byPriority = PRIORITY_ORDER
    .filter((k) => priorityCount[k] > 0)
    .map((k) => ({
      key: k,
      label: t(`analytics.priorityLabels.${k}`) || k.charAt(0).toUpperCase() + k.slice(1),
      value: priorityCount[k],
      color: PRIORITY_COLORS[k] || '#9ca3af',
    }));

  const byCategory = CATEGORY_ORDER
    .filter((k) => categoryCount[k] > 0)
    .map((k) => ({
      key: k,
      label: t(`analytics.categoryLabels.${k}`) || k.charAt(0).toUpperCase() + k.slice(1),
      value: categoryCount[k],
      color: CATEGORY_COLORS[k] || '#9ca3af',
    }));

  // 7-day new case volume from createdAt
  const now = Date.now();
  const trend = Array(7).fill(0);
  cases.forEach((c) => {
    if (!c.createdAt) return;
    const daysAgo = Math.floor((now - new Date(c.createdAt).getTime()) / 86400000);
    if (daysAgo >= 0 && daysAgo < 7) trend[6 - daysAgo]++;
  });

  const total = cases.length;
  const closedCount = cases.filter((c) => {
    const s = (c.status || '').toLowerCase();
    return s === 'closed' || s === 'resolved';
  }).length;

  return {
    byStatus, byPriority, byCategory, trend,
    resolutionTrend: [18, 22, 15, 28, 19, 14, 21],
    total, openCount: total - closedCount,
    slaMet: Math.max(1, Math.round(total * 0.8)),
    slaBreached: Math.max(0, Math.round(total * 0.2)),
    fcr: 68, csat: 4.2, avgResolutionH: 19,
  };
};

const CHANNEL_BADGE_COLOR = {
  voice: 'green', call: 'green', phone: 'green',
  email: 'purple',
  chat: 'blue', whatsapp: 'green', 'in-app': 'violet',
  sms: 'blue', rcs: 'blue',
  task: 'pastel', system: 'mint',
};

// ─── Mock data (Innogy / ACME Corp context) ───────────────────────────

const MOCK_CUSTOMER = {
  name: 'Sarah Johnson',
  email: 'sarah.j@acme-corp.com',
  phone: '+49 89 1234 5678',
  company: 'ACME Corp',
};

const MOCK_CASES_LIST = [
  {
    id: 'CASE-2024-0892',
    caseId: 'CASE-2024-0892',
    status: 'in progress',
    customerName: 'Sarah Johnson',
    customerEmail: 'sarah.j@acme-corp.com',
    createdAt: '2025-06-03T12:00:00Z',
    owner: 'Agent Martinez',
    _isActive: true,
    description: 'Customer reports repeated payment failure for Invoice #INV-2024-0892 ($12,500). Third follow-up in 5 days. SEPA transfer ref: SEPA-20250529-8821 debited from customer account but not reflected in system. Escalating to supervisor level.',
  },
  {
    id: 'CASE-2024-0784',
    caseId: 'CASE-2024-0784',
    status: 'open',
    customerName: 'Sarah Johnson',
    customerEmail: 'sarah.j@acme-corp.com',
    createdAt: '2025-05-28T09:30:00Z',
    owner: 'Agent Chen',
    description: 'Online banking login failure after password reset. Customer unable to access account for 2 days. Two-factor authentication not delivering SMS codes.',
  },
  {
    id: 'CASE-2024-0651',
    caseId: 'CASE-2024-0651',
    status: 'in progress',
    customerName: 'Sarah Johnson',
    customerEmail: 'sarah.j@acme-corp.com',
    createdAt: '2025-05-10T14:15:00Z',
    owner: 'Agent Schmidt',
    description: 'Customer disputes overdraft fee of €45 charged on 8 May. Payment processor delay caused temporary balance mismatch. Back-office review in progress.',
  },
  {
    id: 'CASE-2024-0445',
    caseId: 'CASE-2024-0445',
    status: 'closed',
    customerName: 'Sarah Johnson',
    customerEmail: 'sarah.j@acme-corp.com',
    createdAt: '2025-04-02T10:00:00Z',
    owner: 'Agent Williams',
    description: 'Card blocked during international travel to the United States. Identity verified via video call. Card reactivated within 20 minutes. Customer satisfied.',
  },
  {
    id: 'CASE-2024-0312',
    caseId: 'CASE-2024-0312',
    status: 'closed',
    customerName: 'Sarah Johnson',
    customerEmail: 'sarah.j@acme-corp.com',
    createdAt: '2025-03-15T08:45:00Z',
    owner: 'Agent Martinez',
    description: 'SEPA transfer to supplier delayed 3 business days due to AML screening threshold trigger. Resolved and funds credited. Customer notified with apology.',
  },
];

// ─── Component ─────────────────────────────────────────────────────────────

const CasesView = ({ darkMode, mockMode, highlightCaseId, onNavigate }) => {
  const { locale, t } = useI18n();
  const dispatch = useDispatch();

  // Local expand state used in mock mode
  const [mockExpandedIds, setMockExpandedIds] = useState({});
  const analyticsOpen = useSelector((state) => state.widget.analyticsOpen);
  const [activeFilters, setActiveFilters] = useState({ status: null, priority: null, category: null });
  const isDemoMode = Boolean(mockMode);

  const handleFilterChange = useCallback(({ type, key }) => {
    setActiveFilters((f) => ({ ...f, [type]: key }));
  }, []);
  const highlightRef = useRef(null);

  // Auto-expand and scroll to highlighted case when navigated from History
  useEffect(() => {
    if (!highlightCaseId) return;
    setMockExpandedIds((prev) => ({ ...prev, [highlightCaseId]: true }));
  }, [highlightCaseId]);

  useEffect(() => {
    if (!highlightCaseId || !highlightRef.current) return;
    const timer = setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    return () => clearTimeout(timer);
  }, [highlightCaseId]);

  // Mock data (locale-aware)
  const mockData = getMockData(locale);
  const MOCK_CUSTOMER = mockData.customer;
  const MOCK_CASES_LIST = mockData.cases;

  // Redux state — always called (hook order must be stable)
  const caseWorkflow = useSelector((s) => s.widget.caseWorkflow);
  const customerPanelOpen = caseWorkflow?.customerPanelOpen;

  // Auto-load cases when in real (non-mock) mode
  useEffect(() => {
    if (isDemoMode) return;
    if (!customerPanelOpen) {
      dispatch(toggleCustomerPanelAndLoadCases());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Select data source ──────────────────────────────────────────────────
  const customerData = isDemoMode ? MOCK_CUSTOMER : caseWorkflow?.customerData;
  const activeCase   = isDemoMode ? MOCK_CASES_LIST[0] : caseWorkflow?.caseData;
  const relatedCases = isDemoMode ? MOCK_CASES_LIST.slice(1) : (caseWorkflow?.relatedCases || []);
  const isLoading    = isDemoMode ? false : caseWorkflow?.isLoadingRelatedCases;
  const expandedMap  = isDemoMode ? mockExpandedIds : (caseWorkflow?.relatedExpandedCaseIds || {});

  const handleToggleExpand = (id) => {
    if (isDemoMode) {
      setMockExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
    } else {
      dispatch(toggleRelatedCaseExpanded(id));
    }
  };

  // ── Build unified list ──────────────────────────────────────────────────
  const unified = useMemo(() => {
    const list = [];
    if (activeCase?.caseId) {
      list.push({ ...activeCase, _isActive: true });
    }
    relatedCases.forEach((c) => {
      const id = String(c.id || c.caseId || '');
      if (!id) return;
      if (activeCase?.caseId && String(activeCase.caseId) === id) return;
      list.push(c);
    });
    return list;
  }, [activeCase, relatedCases]);

  // ── Analytics (computed from full case list, not filtered) ───────────────
  const casesAnalyticsData = useMemo(
    () => computeCasesAnalytics(unified, t),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unified, locale],
  );

  // ── Apply quick-filters to the case list for display ────────────────────
  const filteredUnified = useMemo(() => {
    if (!activeFilters.status && !activeFilters.priority && !activeFilters.category) return unified;
    return unified.filter((c) => {
      const sk = (c.status || 'open').toLowerCase().replace(/\s+/g, '-');
      if (activeFilters.status   && sk !== activeFilters.status) return false;
      if (activeFilters.priority && (c.priority || 'medium').toLowerCase() !== activeFilters.priority) return false;
      if (activeFilters.category && (c.category || 'general').toLowerCase() !== activeFilters.category) return false;
      return true;
    });
  }, [unified, activeFilters]);

  const isFiltered = activeFilters.status || activeFilters.priority || activeFilters.category;
  const activeFilterCount = [activeFilters.status, activeFilters.priority, activeFilters.category].filter(Boolean).length;

  const open   = filteredUnified.filter((c) => { const s = (c.status || '').toLowerCase(); return s !== 'closed' && s !== 'resolved'; });
  const closed = filteredUnified.filter((c) => { const s = (c.status || '').toLowerCase(); return s === 'closed' || s === 'resolved'; });

  const renderCase = (item) => {
    const id = String(item.id || item.caseId || '');
    const expanded = Boolean(expandedMap[id]);
    const isHighlighted = id === highlightCaseId;

    // Derive related interactions from history events (demo mode + expanded only)
    const relatedInteractions = (() => {
      if (!expanded || !isDemoMode) return [];
      const seen = new Set();
      return (mockData.history?.events || [])
        .filter((e) => e.caseId === id)
        .filter((e) => { if (seen.has(e.taskId)) return false; seen.add(e.taskId); return true; });
    })();

    return (
      <article
        key={id}
        ref={isHighlighted ? highlightRef : null}
        className={`cases-view__row${item._isActive ? ' cases-view__row--active' : ''}${isHighlighted ? ' cases-view__row--highlighted' : ''}`}
      >
        <div
          className="cases-view__row-head"
          role="button"
          tabIndex={0}
          onClick={() => handleToggleExpand(id)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleToggleExpand(id)}
          aria-expanded={expanded}
        >
          <div className="cases-view__row-title">
            <strong>{item.caseId || item.id}</strong>
            {item._isActive && (
              <Badge color="blue-pastel" rounded>{t('cases.active') || 'Active'}</Badge>
            )}
          </div>
          <div className="cases-view__row-head-right">
            <Badge color={statusColor(item.status)} rounded>
              {item.status || 'open'}
            </Badge>
            <span className="cases-view__row-chevron">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
        <div className="cases-view__row-meta">
          <span>{item.customerName || customerData?.name || '-'}</span>
          <span>·</span>
          <span>{formatDate(item.createdAt)}</span>
          {item.owner && (<><span>·</span><span>{item.owner}</span></>)}
        </div>
        {expanded && item.description && (
          <div className="cases-view__row-desc">{item.description}</div>
        )}
        {relatedInteractions.length > 0 && (
          <div className="cases-view__related-interactions">
            <div className="cases-view__related-interactions-title">
              {t('case.relatedInteractions') || 'Related Interactions'}
            </div>
            {relatedInteractions.map((ev) => {
              const ch = ev.channel || 'task';
              const targetView = ['voice', 'call', 'phone'].includes(ch) ? 'voice'
                : ch === 'email' ? 'email'
                : ['chat', 'whatsapp', 'sms', 'in-app', 'rcs'].includes(ch) ? 'chat'
                : null;
              return (
                <div key={ev.taskId} className="cases-view__related-interaction-row">
                  <Badge color={CHANNEL_BADGE_COLOR[ch] || 'pastel'} rounded>{ch}</Badge>
                  <span className="cases-view__related-interaction-title">
                    {ev.title || ev.taskId}
                  </span>
                  <span className="cases-view__related-interaction-date">
                    {new Date(ev.ts).toLocaleDateString()}
                  </span>
                  {onNavigate && targetView && (
                    <button
                      type="button"
                      className="cases-view__related-interaction-cta"
                      onClick={() => onNavigate(targetView, { taskId: ev.taskId })}
                    >
                      {t('case.actions.openInteraction')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="cases-view__row-actions">
          {!item._isActive && (
            <Button
              color="blue"
              size={28}
              onClick={() => !isDemoMode && dispatch(openRelatedCasePage(item))}
            >
              {t('case.actions.openCase')}
            </Button>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className={`cases-view view-panel${darkMode ? ' md--dark' : ''}`}>
      <div className={`analytics-collapse${analyticsOpen ? ' analytics-collapse--open' : ' analytics-collapse--closed'}${darkMode ? ' analytics-collapse--dark' : ''}`}>
        <div
          className="analytics-collapse__toggle"
          role="button"
          tabIndex={0}
          onClick={() => dispatch(toggleAnalyticsOpen())}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && dispatch(toggleAnalyticsOpen())}
          aria-expanded={analyticsOpen}
        >
          <span className="analytics-collapse__label">{t('analytics.customerAnalytics')}</span>
            <span className="analytics-collapse__header-right">
              <span className="analytics-collapse__chevron">{analyticsOpen ? '▲' : '▼'}</span>
            </span>
        </div>
        {analyticsOpen && (
          <CasesAnalyticsBar
            darkMode={darkMode}
            data={casesAnalyticsData}
            onFilterChange={handleFilterChange}
            activeFilters={activeFilters}
          />
        )}
      </div>

      {/* ── Active filter indicator ── */}
      {isFiltered && (
        <div className="history-view__filter-bar">
          <span className="history-view__filter-bar__label">{t('history.filterActive') || 'Filtered:'}</span>
          {activeFilters.status && (
            <button type="button" className="history-view__filter-chip"
              onClick={() => handleFilterChange({ type: 'status', key: null })}
            >
              {t(`analytics.statusLabels.${activeFilters.status}`) || activeFilters.status} ×
            </button>
          )}
          {activeFilters.priority && (
            <button type="button" className="history-view__filter-chip"
              onClick={() => handleFilterChange({ type: 'priority', key: null })}
            >
              {t(`analytics.priorityLabels.${activeFilters.priority}`) || activeFilters.priority} ×
            </button>
          )}
          {activeFilters.category && (
            <button type="button" className="history-view__filter-chip"
              onClick={() => handleFilterChange({ type: 'category', key: null })}
            >
              {t(`analytics.categoryLabels.${activeFilters.category}`) || activeFilters.category} ×
            </button>
          )}
          {activeFilterCount > 1 && (
            <button type="button" className="history-view__filter-chip history-view__filter-chip--clear"
              onClick={() => setActiveFilters({ status: null, priority: null, category: null })}
            >
              {t('history.clearAll') || 'Clear all'}
            </button>
          )}
        </div>
      )}
      {!onNavigate && (
        <Card className="cases-view__customer" dark={darkMode}>
          <CardSection full>
            <div className="cases-view__customer-name">
              {customerData?.name || activeCase?.customerName || t('cases.noCustomer') || 'No customer selected'}
            </div>
            {(customerData?.email || activeCase?.customerEmail) && (
              <div className="cases-view__customer-meta">
                {customerData?.email || activeCase?.customerEmail}
                {customerData?.company && <> · {customerData.company}</>}
              </div>
            )}
          </CardSection>
        </Card>
      )}

      <section className="cases-view__group">
        <header className="cases-view__group-head">
          <h3 className="md-h4">{t('cases.openTitle') || 'Open cases'}</h3>
          <Badge color="default">{open.length}</Badge>
        </header>
        {isLoading && <div className="cases-view__loading">{t('case.related.loading') || 'Loading...'}</div>}
        {!isLoading && open.length === 0 && (
          <div className="cases-view__empty">{t('cases.openEmpty') || 'No open cases.'}</div>
        )}
        <div className="cases-view__list">{open.map(renderCase)}</div>
      </section>

      <section className="cases-view__group">
        <header className="cases-view__group-head">
          <h3 className="md-h4">{t('cases.closedTitle') || 'Closed cases'}</h3>
          <Badge color="default">{closed.length}</Badge>
        </header>
        {!isLoading && closed.length === 0 && (
          <div className="cases-view__empty">{t('cases.closedEmpty') || 'No closed cases.'}</div>
        )}
        <div className="cases-view__list">{closed.map(renderCase)}</div>
      </section>
    </div>
  );
};

CasesView.propTypes = { darkMode: PropTypes.bool, mockMode: PropTypes.bool, onNavigate: PropTypes.func };
CasesView.defaultProps = { darkMode: false, mockMode: false };

export default CasesView;
