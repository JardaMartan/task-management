import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { Badge, Button, Card, CardSection } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import CasesAnalyticsBar from './CasesAnalyticsBar';
import {
  toggleCustomerPanelAndLoadCases,
  toggleRelatedCaseExpanded,
  openRelatedCasePage,
} from '../store';

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

// ─── Mock data (Moneta Bank / ACME Corp context) ───────────────────────────

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

const CasesView = ({ darkMode, mockMode }) => {
  const { t } = useI18n();
  const dispatch = useDispatch();

  // Local expand state used in mock mode
  const [mockExpandedIds, setMockExpandedIds] = useState({});
  const [analyticsOpen, setAnalyticsOpen] = useState(true);

  // Redux state — always called (hook order must be stable)
  const caseWorkflow = useSelector((s) => s.widget.caseWorkflow);
  const customerPanelOpen = caseWorkflow?.customerPanelOpen;

  // Auto-load cases when in real (non-mock) mode
  useEffect(() => {
    if (mockMode) return;
    if (!customerPanelOpen) {
      dispatch(toggleCustomerPanelAndLoadCases());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Select data source ──────────────────────────────────────────────────
  const customerData = mockMode ? MOCK_CUSTOMER : caseWorkflow?.customerData;
  const activeCase   = mockMode ? MOCK_CASES_LIST[0] : caseWorkflow?.caseData;
  const relatedCases = mockMode ? MOCK_CASES_LIST.slice(1) : (caseWorkflow?.relatedCases || []);
  const isLoading    = mockMode ? false : caseWorkflow?.isLoadingRelatedCases;
  const expandedMap  = mockMode ? mockExpandedIds : (caseWorkflow?.relatedExpandedCaseIds || {});

  const handleToggleExpand = (id) => {
    if (mockMode) {
      setMockExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
    } else {
      dispatch(toggleRelatedCaseExpanded(id));
    }
  };

  // ── Build unified list ──────────────────────────────────────────────────
  const unified = [];
  if (activeCase?.caseId) {
    unified.push({ ...activeCase, _isActive: true });
  }
  relatedCases.forEach((c) => {
    const id = String(c.id || c.caseId || '');
    if (!id) return;
    if (activeCase?.caseId && String(activeCase.caseId) === id) return;
    unified.push(c);
  });

  const open = unified.filter((c) => String(c.status || '').toLowerCase() !== 'closed');
  const closed = unified.filter((c) => String(c.status || '').toLowerCase() === 'closed');

  const renderCase = (item) => {
    const id = String(item.id || item.caseId || '');
    const expanded = Boolean(expandedMap[id]);
    return (
      <article
        key={id}
        className={`cases-view__row${item._isActive ? ' cases-view__row--active' : ''}`}
      >
        <div className="cases-view__row-head">
          <div className="cases-view__row-title">
            <strong>{item.caseId || item.id}</strong>
            {item._isActive && (
              <Badge color="blue-pastel" rounded>{t('cases.active') || 'Active'}</Badge>
            )}
          </div>
          <Badge color={statusColor(item.status)} rounded>
            {item.status || 'open'}
          </Badge>
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
        <div className="cases-view__row-actions">
          <Button
            color="none"
            size={28}
            onClick={() => handleToggleExpand(id)}
          >
            {expanded ? (t('case.actions.collapseCase') || 'Less') : (t('case.actions.expandCase') || 'More')}
          </Button>
          {!item._isActive && (
            <Button
              color="blue"
              size={28}
              onClick={() => !mockMode && dispatch(openRelatedCasePage(item))}
            >
              {t('case.actions.openCase') || 'Open'}
            </Button>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className={`cases-view view-panel${darkMode ? ' md--dark' : ''}`}>
      <div className={`analytics-collapse${analyticsOpen ? ' analytics-collapse--open' : ' analytics-collapse--closed'}${darkMode ? ' analytics-collapse--dark' : ''}`}>
        <button
          className="analytics-collapse__toggle"
          onClick={() => setAnalyticsOpen((o) => !o)}
          aria-expanded={analyticsOpen}
        >
          <span className="analytics-collapse__label">Customer Analytics</span>
          <span className="analytics-collapse__chevron">{analyticsOpen ? '▲' : '▼'}</span>
        </button>
        {analyticsOpen && <CasesAnalyticsBar darkMode={darkMode} />}
      </div>
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

CasesView.propTypes = { darkMode: PropTypes.bool, mockMode: PropTypes.bool };
CasesView.defaultProps = { darkMode: false, mockMode: false };

export default CasesView;
