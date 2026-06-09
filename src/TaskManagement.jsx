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
  loadJdsHistoryForEmailTask,
  loadJdsHistoryForWorkItemTask,
  extractEmailFromTask,
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
import UnifiedView360 from './views/UnifiedView360';
import TaskWidget from './task/TaskWidget';
import './ui/widget-layout.css';
import './views/views.css';

const parseTaskInput = (task, taskType, email) => {
  if (!task) return null;

  // Always produce a plain serializable object. The Desktop SDK passes task as a
  // MobX observable (from $STORE.agentContact.taskSelected). Storing a MobX
  // observable in Redux state causes immer to call Object.freeze on it, which
  // triggers MobX error 15 ("Observable arrays cannot be frozen") on every
  // subsequent dispatch. JSON round-trip strips all proxy wrapping.
  const parsed = (() => {
    try {
      const raw = typeof task === 'string' ? JSON.parse(task) : task;
      return JSON.parse(JSON.stringify(raw));
    } catch (error) {
      console.warn('TaskManagement: failed to serialize task payload', error);
      return null;
    }
  })();

  if (!parsed) return null;

  // Extract email from all known task payload locations if not provided as explicit prop
  const extractedEmail = extractEmailFromTask(parsed);
  const resolvedEmail = email || extractedEmail || undefined;

  return {
    ...parsed,
    taskType: taskType || undefined,
    email: resolvedEmail,
    customerEmail: resolvedEmail,
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
    // Work-item tasks carry taskType inside channelParams.message.workItemData
    task.channelParams?.message?.workItemData?.taskType ||
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

  // Derive a stable key from actionable task fields so taskPayload (and effects
  // that depend on it) do not recalculate on every Desktop heartbeat update
  // (monitoringHoldTimer / bargedInTimeStamp change every few seconds).
  const stableTaskKey = useMemo(() => {
    if (!props.task) return '';
    const t = typeof props.task === 'string'
      ? (() => { try { return JSON.parse(props.task); } catch { return {}; } })()
      : props.task;
    return `${t.interactionId}|${t.state}|${t.isWrapUp}|${t.isTerminated}|${t.ani}`;
  }, [props.task]);

  const taskPayload = useMemo(
    () => parseTaskInput(props.task, props.taskType, props.email),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stableTaskKey, props.taskType, props.email],
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

  // When an email task arrives (native email channel OR work-item with taskType=email),
  // fetch the customer's full event history from JDS so the History panel is populated.
  const isEmailTaskForJds =
    taskPayload?.mediaType === 'email' ||
    getNormalizedTaskType(taskPayload) === 'email';

  // Extract only the stable identity fields so the effect does not re-fire on
  // every heartbeat update (monitoringHoldTimer, bargedInTimeStamp, etc. change
  // every few seconds even when the actual task/customer doesn't change).
  const emailForJds = useMemo(
    () => isEmailTaskForJds ? extractEmailFromTask(taskPayload) : null,
    // Depend on the fields that actually identify the task, not the whole object
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [taskPayload?.interactionId, taskPayload?.ani, taskPayload?.mediaType],
  );

  useEffect(() => {
    if (emailForJds && taskPayload) {
      dispatch(loadJdsHistoryForEmailTask(taskPayload));
    }
  }, [dispatch, emailForJds]); // eslint-disable-line react-hooks/exhaustive-deps

  // WorkItem tasks: use both phone (ANI) and email from CAD to fetch JDS history
  // and subscribe to SSE for real-time events.
  const isWorkItemForJds = taskPayload?.mediaType === 'workItem';
  useEffect(() => {
    if (isWorkItemForJds && taskPayload) {
      dispatch(loadJdsHistoryForWorkItemTask(taskPayload));
    }
  // Stable identity deps only — interactionId changes when a new workItem arrives
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, taskPayload?.interactionId, isWorkItemForJds]);

  useEffect(() => {
    dispatch(setDarkMode(props.darkmode));
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
  const isEmailTask = isEmailTaskForJds; // mediaType=email OR taskType=email (incl. work-items)
  const isWorkItemTask = taskPayload?.mediaType === 'workItem';

  // Build enriched callAssociatedDetails so EmailWidget always has the customer email,
  // regardless of which payload field the Desktop used to deliver it.
  const buildEmailCallDetails = (payload) => {
    if (!payload) return null;
    const raw = payload.callAssociatedDetails || payload.callAssociatedData || {};

    // Helper: unwrap CAD value objects { value: "..." } or plain strings
    const cadVal = (field) => {
      const v = raw[field];
      if (!v) return null;
      return typeof v === 'object' && 'value' in v ? v.value : String(v);
    };

    const isWorkItem = payload.mediaType === 'workItem';
    // For workItem tasks ANI is a phone number — use explicit CAD 'email' field.
    // For native email tasks, ANI IS the sender address.
    const fromAddress = isWorkItem
      ? (cadVal('email') || raw.fromAddress || payload.email || null)
      : (cadVal('fromAddress') || payload.customerEmail || payload.email || payload.ani || payload.displayAni || null);

    // Gmail identifiers: populated once Webex Connect flow maps them as CAD vars.
    const gmailThreadId = cadVal('gmailThreadId') || null;
    const gmailMessageId = cadVal('gmailMessageId') || null;
    // RFC 2822 Message-ID from the original email headers — enables rfc822msgid: search.
    const rfcMessageId = cadVal('rfcMessageId') || null;

    // Email subject: prefer CAD, fall back to mediaProperties.
    const subject =
      cadVal('subject') ||
      payload.mediaProperties?.emailSubject ||
      null;

    return { ...raw, customerEmail: fromAddress, fromAddress, gmailThreadId, gmailMessageId, rfcMessageId, subject };
  };

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
  if (explicitView === '360' || explicitView === '360-mock') {
    return (
      <div className={`tm-view-mount${darkMode ? ' md--dark' : ''}`}>
        <UnifiedView360
          darkMode={darkMode}
          mockMode={explicitView === '360-mock' || !taskPayload}
          task={taskPayload}
        />
      </div>
    );
  }
  if (explicitView === 'email') {
    return (
      <div className={`tm-view-mount${darkMode ? ' md--dark' : ''}`}>
        {taskPayload ? (
          <EmailWidget
            interactionId={taskPayload.taskId || taskPayload.id || taskPayload.interactionId || ''}
            callAssociatedDetails={buildEmailCallDetails(taskPayload)}
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
  if (explicitView === 'task') {
    return (
      <div className={`tm-view-mount${darkMode ? ' md--dark' : ''}`}>
        <TaskWidget task={taskPayload} darkMode={darkMode} />
      </div>
    );
  }
  if (explicitView === 'task-mock') {
    return (
      <div className={`tm-view-mount${darkMode ? ' md--dark' : ''}`}>
        <TaskWidget darkMode={darkMode} mockMode />
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

      {taskPayload && isWorkItemTask ? (
        <TaskWidget task={taskPayload} darkMode={darkMode} />
      ) : null}

      {taskPayload && !isCaseTask && !isEmailTask && !isWorkItemTask ? (
        <MomentumCard dark={darkMode}>{t('case.unsupportedTaskType', { taskType: taskPayload.taskType || '-' })}</MomentumCard>
      ) : null}

      {taskPayload && isEmailTask ? (
        <EmailWidget
          interactionId={taskPayload.taskId || taskPayload.id || taskPayload.interactionId || ''}
          callAssociatedDetails={buildEmailCallDetails(taskPayload)}
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
