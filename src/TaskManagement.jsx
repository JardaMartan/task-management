import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  hydrateWidgetContext,
  initializeDesktopSDK,
  loadCaseTask,
  loadMoreCaseHistory,
  navigateBackToPreviousCase,
  openRelatedCasePage,
  saveCaseNotes,
  saveCaseStatus,
  setDarkMode,
  toggleRelatedCaseExpanded,
  toggleCustomerPanelAndLoadCases,
} from './store';
import { Badge, Button, Input, Label } from '@momentum-ui/react';
import { useI18n } from './i18n/I18nContext';
import {
  MomentumCard,
  MomentumSelect,
} from './ui/momentumPrimitives';
import EmailWidget from './email/EmailWidget';
import ChatView from './views/ChatView';
import ChatWidget from './chat/ChatWidget';
import VoiceWidget from './voice/VoiceWidget';
import CasesView from './views/CasesView';
import HistoryView from './views/HistoryView';
import './ui/widget-layout.css';
import './views/views.css';

const parseTaskInput = (task, taskType, email) => {
  if (!task) return null;
  const mergedTopLevel = {
    taskType: taskType || undefined,
    email: email || undefined,
    customerEmail: email || undefined,
  };

  if (typeof task === 'string') {
    try {
      return {
        ...JSON.parse(task),
        ...mergedTopLevel,
      };
    } catch (error) {
      console.warn('TaskManagement: invalid task JSON payload', error);
      return null;
    }
  }
  return {
    ...task,
    ...mergedTopLevel,
  };
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const badgeColorForType = (interactionType) => {
  const value = String(interactionType || '').toLowerCase();
  if (value.includes('chat')) return 'blue';
  if (value.includes('email')) return 'purple';
  if (value.includes('phone') || value.includes('call')) return 'green';
  return 'pastel';
};

const normalizeCaseStatus = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'inprogress') return 'in progress';
  if (normalized === 'closed') return 'closed';
  return 'open';
};

const getTaskCaseId = (task) => {
  if (!task) return null;
  return (
    task.caseId ||
    task.caseid ||
    task.callAssociatedData?.caseId?.value ||
    task.callAssociatedDetails?.caseId ||
    null
  );
};

const getNormalizedTaskType = (task) => {
  if (!task) return '';
  
  // Only check explicit task type sources, NOT task.type (which is the event type)
  const explicitType = String(
    task.taskType ||
    task.callAssociatedData?.taskType?.value ||
    task.callAssociatedDetails?.taskType ||
    '',
  ).toLowerCase();

  if (explicitType) return explicitType;
  
  // If no explicit task type, infer from presence of caseId
  return getTaskCaseId(task) ? 'case' : '';
};

const TaskManagement = (props) => {
  const dispatch = useDispatch();
  const { t } = useI18n();

  const {
    status,
    statusType,
    darkMode,
    caseWorkflow,
  } = useSelector((state) => state.widget);

  const taskPayload = useMemo(
    () => parseTaskInput(props.task, props.taskType, props.email),
    [props.task, props.taskType, props.email],
  );
  const [noteDraft, setNoteDraft] = useState('');
  const sdkInitStartedRef = useRef(false);

  useEffect(() => {
    if (sdkInitStartedRef.current) return;

    const hasDesktopContext = Boolean(
      props.accesstoken ||
      props.orgid ||
      props.workspaceid ||
      props.agent,
    );

    if (!hasDesktopContext) {
      return;
    }

    sdkInitStartedRef.current = true;
    dispatch(initializeDesktopSDK());
  }, [dispatch, props.accesstoken, props.orgid, props.workspaceid, props.agent]);

  useEffect(() => {
    dispatch(hydrateWidgetContext(props));
  }, [
    dispatch,
    props.accesstoken,
    props.orgid,
    props.datacenter,
    props.workspaceid,
    props.agent,
    props.config,
  ]);

  useEffect(() => {
    dispatch(loadCaseTask(taskPayload));
  }, [dispatch, taskPayload]);

  useEffect(() => {
    if (props.darkmode !== undefined) {
      dispatch(setDarkMode(props.darkmode));
    }
  }, [dispatch, props.darkmode]);

  useEffect(() => {
    setNoteDraft(caseWorkflow.caseData?.notes || '');
  }, [caseWorkflow.caseData?.notes]);

  const onSaveNotes = () => {
    dispatch(saveCaseNotes(noteDraft));
  };

  const onStatusSelect = (value) => {
    dispatch(saveCaseStatus(value));
  };

  const onToggleCustomerPanel = () => {
    dispatch(toggleCustomerPanelAndLoadCases());
  };

  const onToggleRelatedCase = (item) => {
    const id = String(item?.id || item?.caseId || '');
    if (!id) return;
    dispatch(toggleRelatedCaseExpanded(id));
  };

  const onOpenRelatedCase = (item) => {
    dispatch(openRelatedCasePage(item));
  };

  const onBackToPreviousCase = () => {
    dispatch(navigateBackToPreviousCase());
  };

  const isCaseTask = getNormalizedTaskType(taskPayload) === 'case';
  const isEmailTask =
    taskPayload?.mediaType === 'email' ||
    getNormalizedTaskType(taskPayload) === 'email';

  // Explicit view routing (set via web component `view` attribute in desktop layout JSON).
  // Lets the same standalone bundle act as multiple visually-distinct widgets.
  const explicitView = String(props.view || '').toLowerCase();
  if (explicitView === 'chat') {
    return (
      <div className={`tm-view-mount${darkMode ? ' md--dark' : ''}`}>
        <ChatView darkMode={darkMode} />
      </div>
    );
  }
  if (explicitView === 'chat-mock') {
    return (
      <div className={`tm-view-mount${darkMode ? ' md--dark' : ''}`}>
        <ChatWidget darkMode={darkMode} mockMode />
      </div>
    );
  }
  if (explicitView === 'voice-mock') {
    return (
      <div className={`tm-view-mount${darkMode ? ' md--dark' : ''}`}>
        <VoiceWidget darkMode={darkMode} />
      </div>
    );
  }
  if (explicitView === 'history') {
    return (
      <div className={`tm-view-mount${darkMode ? ' md--dark' : ''}`}>
        <HistoryView darkMode={darkMode} />
      </div>
    );
  }
  if (explicitView === 'history-mock') {
    return (
      <div className={`tm-view-mount${darkMode ? ' md--dark' : ''}`}>
        <HistoryView darkMode={darkMode} mockMode />
      </div>
    );
  }
  if (explicitView === 'cases') {
    return (
      <div className={`tm-view-mount${darkMode ? ' md--dark' : ''}`}>
        <CasesView darkMode={darkMode} />
      </div>
    );
  }
  if (explicitView === 'cases-mock') {
    return (
      <div className={`tm-view-mount${darkMode ? ' md--dark' : ''}`}>
        <CasesView darkMode={darkMode} mockMode />
      </div>
    );
  }
  if (explicitView === 'email') {
    return (
      <div className={`tm-view-mount${darkMode ? ' md--dark' : ''}`}>
        {taskPayload ? (
          <EmailWidget
            interactionId={taskPayload.taskId || taskPayload.id || taskPayload.interactionId || ''}
            callAssociatedDetails={taskPayload.callAssociatedDetails || taskPayload.callAssociatedData || taskPayload}
            darkMode={darkMode}
          />
        ) : (
          <MomentumCard dark={darkMode}>{t('case.noTask')}</MomentumCard>
        )}
      </div>
    );
  }
  if (explicitView === 'email-mock') {
    return (
      <div className={`tm-view-mount${darkMode ? ' md--dark' : ''}`}>
        <EmailWidget interactionId="mock-001" darkMode={darkMode} mockMode />
      </div>
    );
  }

  const caseStatusOptions = [
    { value: 'open', label: t('case.statusValues.open') },
    { value: 'in progress', label: t('case.statusValues.inProgress') },
    { value: 'closed', label: t('case.statusValues.closed') },
  ];

  return (
    <div className={`case-detail${darkMode ? ' md--dark' : ''}`}>
      <div className="case-detail__toolbar">
        <div />
        <div className="case-detail__toolbar-actions">
          {caseWorkflow.caseNavigationStack.length > 0 ? (
            <Button color='blue' onClick={onBackToPreviousCase}>
              {t('case.actions.backToPreviousCase')}
            </Button>
          ) : null}
          {status ? (
            <Badge
              color={statusType === 'error' ? 'red-pastel' : statusType === 'warning' ? 'yellow-pastel' : 'green-pastel'}
              rounded
            >
              {t(status)}
            </Badge>
          ) : null}
        </div>
      </div>

      {!taskPayload ? (
        <MomentumCard dark={darkMode}>{t('case.noTask')}</MomentumCard>
      ) : null}

      {taskPayload && !isCaseTask && !isEmailTask ? (
        <MomentumCard dark={darkMode}>{t('case.unsupportedTaskType', { taskType: taskPayload.taskType || '-' })}</MomentumCard>
      ) : null}

      {taskPayload && isEmailTask ? (
        <EmailWidget
          interactionId={taskPayload.taskId || taskPayload.id || taskPayload.interactionId || ''}
          callAssociatedDetails={taskPayload.callAssociatedDetails || taskPayload.callAssociatedData || taskPayload}
          darkMode={darkMode}
        />
      ) : null}

      {isCaseTask && caseWorkflow.isLoading ? (
        <MomentumCard dark={darkMode}>{t('case.loading')}</MomentumCard>
      ) : null}

      {isCaseTask && !caseWorkflow.isLoading && !caseWorkflow.caseData ? (
        <MomentumCard dark={darkMode}>{t('case.notFound')}</MomentumCard>
      ) : null}

      {isCaseTask && caseWorkflow.caseData ? (
        <>
          <MomentumCard dark={darkMode} className="case-detail__fields-grid">
            <div>
              <Label>{t('case.fields.caseId')}</Label>
              <div className="case-detail__field-value">{caseWorkflow.caseData.caseId || '-'}</div>
            </div>
            <div>
              <Label>{t('case.fields.status')}</Label>
              <div className="case-detail__field-value">
                <MomentumSelect
                  id='case-status-select'
                  value={normalizeCaseStatus(caseWorkflow.caseData.status)}
                  options={caseStatusOptions}
                  disabled={caseWorkflow.isSavingStatus}
                  onChange={onStatusSelect}
                  className="case-detail__status-select"
                />
              </div>
            </div>
            <div>
              <Label>{t('case.fields.customer')}</Label>
              <div className="case-detail__field-value">
                <span>{caseWorkflow.caseData.customerName || '-'}</span>
              </div>
            </div>
            <div>
              <Label>{t('case.fields.owner')}</Label>
              <div className="case-detail__field-value">{caseWorkflow.caseData.owner || '-'}</div>
            </div>
            <div>
              <Label>{t('case.fields.createdAt')}</Label>
              <div className="case-detail__field-value">{formatDate(caseWorkflow.caseData.createdAt)}</div>
            </div>
            <div>
              <Label>{t('case.fields.assetId')}</Label>
              <div className="case-detail__field-value">{caseWorkflow.caseData.assetId || '-'}</div>
            </div>

            <div className="case-detail__toggle-row">
              <Button color='blue' onClick={onToggleCustomerPanel}>
                {caseWorkflow.customerPanelOpen
                  ? t('case.actions.hideCustomerCases')
                  : t('case.actions.showCustomerCases')}
              </Button>
            </div>
          </MomentumCard>

          {caseWorkflow.customerPanelOpen ? (
            <>
              <MomentumCard dark={darkMode}>
                <h3 className="case-detail__card-title">{t('case.customerCard.title')}</h3>
                <div className="case-detail__customer-grid">
                  <div>
                    <Label>{t('case.fields.customer')}</Label>
                    <div className="case-detail__field-value">
                      {caseWorkflow.customerData?.name || caseWorkflow.caseData.customerName || '-'}
                    </div>
                  </div>
                  <div>
                    <Label>{t('case.customerCard.email')}</Label>
                    <div className="case-detail__field-value">
                      {caseWorkflow.customerData?.email || caseWorkflow.caseData.customerEmail || '-'}
                    </div>
                  </div>
                  <div>
                    <Label>{t('case.customerCard.phone')}</Label>
                    <div className="case-detail__field-value">
                      {caseWorkflow.customerData?.phone || caseWorkflow.caseData.customerPhone || '-'}
                    </div>
                  </div>
                  <div>
                    <Label>{t('case.customerCard.city')}</Label>
                    <div className="case-detail__field-value">
                      {caseWorkflow.customerData?.city || '-'}
                    </div>
                  </div>
                  <div>
                    <Label>{t('case.customerCard.country')}</Label>
                    <div className="case-detail__field-value">
                      {caseWorkflow.customerData?.country || '-'}
                    </div>
                  </div>
                </div>
                <div className="case-detail__source-note">
                  {t('case.customerCard.source', {
                    source: caseWorkflow.customerData?.enrichmentSource || caseWorkflow.customerData?.source || 'unknown',
                  })}
                </div>
              </MomentumCard>

              <MomentumCard dark={darkMode}>
                <div className="case-detail__card-head">
                  <h3 className="case-detail__card-title">{t('case.related.title')}</h3>
                  <Button color='none' onClick={onToggleCustomerPanel}>
                    {t('case.actions.hideCustomerCases')}
                  </Button>
                </div>

                {caseWorkflow.isLoadingRelatedCases ? (
                  <div>{t('case.related.loading')}</div>
                ) : null}

                {!caseWorkflow.isLoadingRelatedCases && caseWorkflow.relatedCasesError ? (
                  <div>{t(caseWorkflow.relatedCasesError)}</div>
                ) : null}

                {!caseWorkflow.isLoadingRelatedCases && !caseWorkflow.relatedCasesError && caseWorkflow.relatedCases.length === 0 ? (
                  <div>{t('case.related.empty')}</div>
                ) : null}

                {!caseWorkflow.isLoadingRelatedCases && caseWorkflow.relatedCases.length > 0 ? (
                  <div className="case-detail__item-list">
                    {caseWorkflow.relatedCases.map((item) => (
                      (() => {
                        const relatedId = String(item.id || item.caseId || '');
                        const isExpanded = Boolean(caseWorkflow.relatedExpandedCaseIds[relatedId]);

                        return (
                          <article
                            key={relatedId || item.caseId || item.id}
                            className="case-detail__item case-detail__item--clickable"
                            onClick={() => onToggleRelatedCase(item)}
                          >
                            <div className="case-detail__item-head">
                              <strong className="case-detail__item-id">{item.caseId || item.id}</strong>
                              <span />
                            </div>

                            <div className="case-detail__item-date">
                              {t('case.related.created', { value: formatDate(item.createdAt) })}
                            </div>

                            <div className="case-detail__item-actions">
                              <Button
                                color='none'
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onToggleRelatedCase(item);
                                }}
                              >
                                {isExpanded ? t('case.actions.collapseCase') : t('case.actions.expandCase')}
                              </Button>
                              <Button
                                color='blue'
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onOpenRelatedCase(item);
                                }}
                              >
                                {t('case.actions.openCase')}
                              </Button>
                            </div>

                            {isExpanded ? (
                              <div className="case-detail__item-body">
                                <Label>{t('case.related.details')}</Label>
                                <div className="case-detail__item-desc">{item.description || '-'}</div>
                                <div className="case-detail__item-meta">
                                  {t('case.fields.owner')}: {item.owner || '-'}
                                </div>
                              </div>
                            ) : null}
                          </article>
                        );
                      })()
                    ))}
                  </div>
                ) : null}
              </MomentumCard>
            </>
          ) : null}

          <MomentumCard dark={darkMode}>
            <Label>{t('case.fields.description')}</Label>
            <div className="case-detail__desc-value">{caseWorkflow.caseData.description || '-'}</div>

            <Input
              htmlId='case-notes-textarea'
              id='case-notes-textarea'
              label={t('case.fields.notes')}
              multiline
              rows={5}
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              disabled={caseWorkflow.isSavingNotes}
              inputClassName='md-textarea'
            />
            <div className="case-detail__save-row">
              <Button
                color='blue'
                onClick={onSaveNotes}
                disabled={caseWorkflow.isSavingNotes}
              >
                {t('case.actions.saveNotes')}
              </Button>
            </div>
          </MomentumCard>

          <MomentumCard dark={darkMode}>
            <div className="case-detail__card-head">
              <h3 className="case-detail__card-title">{t('case.history.title')}</h3>
              {caseWorkflow.customerData ? (
                <span className="case-detail__card-meta">
                  {t('case.history.customerSource', { source: caseWorkflow.customerData.enrichmentSource || caseWorkflow.customerData.source })}
                </span>
              ) : null}
            </div>

            {caseWorkflow.visibleHistory.length === 0 ? (
              <div>{t('case.history.empty')}</div>
            ) : (
              <div className="case-detail__item-list">
                {caseWorkflow.visibleHistory.map((item) => (
                  <article
                    key={item.id}
                    className="case-detail__item"
                  >
                    <div className="case-detail__item-head">
                      <strong className="case-detail__item-id">{item.title || t('case.history.entry')}</strong>
                      <Badge color={badgeColorForType(item.interactionType)} rounded>
                        {t(`case.history.types.${String(item.interactionType || 'task').toLowerCase()}`)}
                      </Badge>
                    </div>
                    <div className="case-detail__item-date">{formatDate(item.timestamp)}</div>
                    <div className="case-detail__item-desc">{item.summary || '-'}</div>
                    {item.details ? (
                      <div className="case-detail__item-meta">{item.details}</div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}

            {caseWorkflow.hasMoreHistory ? (
              <div className="case-detail__load-more">
                <Button
                  color='none'
                  onClick={() => dispatch(loadMoreCaseHistory())}
                >
                  {t('case.actions.loadMoreHistory')}
                </Button>
              </div>
            ) : null}
          </MomentumCard>
        </>
      ) : null}
    </div>
  );
};

export default TaskManagement;
