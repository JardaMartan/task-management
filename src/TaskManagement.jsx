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
  const caseStatusOptions = [
    { value: 'open', label: t('case.statusValues.open') },
    { value: 'in progress', label: t('case.statusValues.inProgress') },
    { value: 'closed', label: t('case.statusValues.closed') },
  ];

  const rootStyle = {
    minHeight: '100%',
    width: '100%',
    padding: 16,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    ...(props.style || {}),
  };

  return (
    <div className={darkMode ? 'md--dark' : undefined} style={rootStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

      {taskPayload && !isCaseTask ? (
        <MomentumCard dark={darkMode}>{t('case.unsupportedTaskType', { taskType: taskPayload.taskType || '-' })}</MomentumCard>
      ) : null}

      {isCaseTask && caseWorkflow.isLoading ? (
        <MomentumCard dark={darkMode}>{t('case.loading')}</MomentumCard>
      ) : null}

      {isCaseTask && !caseWorkflow.isLoading && !caseWorkflow.caseData ? (
        <MomentumCard dark={darkMode}>{t('case.notFound')}</MomentumCard>
      ) : null}

      {isCaseTask && caseWorkflow.caseData ? (
        <>
          <MomentumCard dark={darkMode} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <Label>{t('case.fields.caseId')}</Label>
              <div style={{ marginTop: 4 }}>{caseWorkflow.caseData.caseId || '-'}</div>
            </div>
            <div>
              <Label>{t('case.fields.status')}</Label>
              <div style={{ marginTop: 4 }}>
                <MomentumSelect
                  id='case-status-select'
                  value={normalizeCaseStatus(caseWorkflow.caseData.status)}
                  options={caseStatusOptions}
                  disabled={caseWorkflow.isSavingStatus}
                  onChange={onStatusSelect}
                  style={{ maxWidth: 240 }}
                />
              </div>
            </div>
            <div>
              <Label>{t('case.fields.customer')}</Label>
              <div style={{ marginTop: 4 }}>
                <span>{caseWorkflow.caseData.customerName || '-'}</span>
              </div>
            </div>
            <div>
              <Label>{t('case.fields.owner')}</Label>
              <div style={{ marginTop: 4 }}>{caseWorkflow.caseData.owner || '-'}</div>
            </div>
            <div>
              <Label>{t('case.fields.createdAt')}</Label>
              <div style={{ marginTop: 4 }}>{formatDate(caseWorkflow.caseData.createdAt)}</div>
            </div>
            <div>
              <Label>{t('case.fields.assetId')}</Label>
              <div style={{ marginTop: 4 }}>{caseWorkflow.caseData.assetId || '-'}</div>
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
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
                <h3 style={{ margin: '0 0 10px 0', fontSize: 16 }}>{t('case.customerCard.title')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  <div>
                    <Label>{t('case.fields.customer')}</Label>
                    <div style={{ marginTop: 4 }}>
                      {caseWorkflow.customerData?.name || caseWorkflow.caseData.customerName || '-'}
                    </div>
                  </div>
                  <div>
                    <Label>{t('case.customerCard.email')}</Label>
                    <div style={{ marginTop: 4 }}>
                      {caseWorkflow.customerData?.email || caseWorkflow.caseData.customerEmail || '-'}
                    </div>
                  </div>
                  <div>
                    <Label>{t('case.customerCard.phone')}</Label>
                    <div style={{ marginTop: 4 }}>
                      {caseWorkflow.customerData?.phone || caseWorkflow.caseData.customerPhone || '-'}
                    </div>
                  </div>
                  <div>
                    <Label>{t('case.customerCard.city')}</Label>
                    <div style={{ marginTop: 4 }}>
                      {caseWorkflow.customerData?.city || '-'}
                    </div>
                  </div>
                  <div>
                    <Label>{t('case.customerCard.country')}</Label>
                    <div style={{ marginTop: 4 }}>
                      {caseWorkflow.customerData?.country || '-'}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: 12 }}>
                  {t('case.customerCard.source', {
                    source: caseWorkflow.customerData?.enrichmentSource || caseWorkflow.customerData?.source || 'unknown',
                  })}
                </div>
              </MomentumCard>

              <MomentumCard dark={darkMode}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{t('case.related.title')}</h3>
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {caseWorkflow.relatedCases.map((item) => (
                      (() => {
                        const relatedId = String(item.id || item.caseId || '');
                        const isExpanded = Boolean(caseWorkflow.relatedExpandedCaseIds[relatedId]);

                        return (
                          <article
                            key={relatedId || item.caseId || item.id}
                            onClick={() => onToggleRelatedCase(item)}
                            style={{ borderRadius: 8, padding: 10, cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: 14 }}>{item.caseId || item.id}</strong>
                              <span style={{ fontSize: 12 }}>
                              </span>
                            </div>

                            <div style={{ fontSize: 12, marginTop: 4 }}>
                              {t('case.related.created', { value: formatDate(item.createdAt) })}
                            </div>

                            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                              <div style={{ marginTop: 8 }}>
                                <Label>{t('case.related.details')}</Label>
                                <div style={{ fontSize: 13, marginTop: 4 }}>{item.description || '-'}</div>
                                <div style={{ fontSize: 12, marginTop: 4 }}>
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
            <div style={{ marginTop: 4, marginBottom: 12 }}>{caseWorkflow.caseData.description || '-'}</div>

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
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{t('case.history.title')}</h3>
              {caseWorkflow.customerData ? (
                <span style={{ fontSize: 12 }}>
                  {t('case.history.customerSource', { source: caseWorkflow.customerData.enrichmentSource || caseWorkflow.customerData.source })}
                </span>
              ) : null}
            </div>

            {caseWorkflow.visibleHistory.length === 0 ? (
              <div>{t('case.history.empty')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {caseWorkflow.visibleHistory.map((item) => (
                  <article
                    key={item.id}
                    style={{ borderRadius: 8, padding: 10 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 14 }}>{item.title || t('case.history.entry')}</strong>
                      <Badge color={badgeColorForType(item.interactionType)} rounded>
                        {t(`case.history.types.${String(item.interactionType || 'task').toLowerCase()}`)}
                      </Badge>
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>{formatDate(item.timestamp)}</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>{item.summary || '-'}</div>
                    {item.details ? (
                      <div style={{ fontSize: 12, marginTop: 4 }}>{item.details}</div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}

            {caseWorkflow.hasMoreHistory ? (
              <div style={{ marginTop: 10 }}>
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
