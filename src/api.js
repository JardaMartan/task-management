/**
 * API functions for Journey Data Service (JDS) integration
 * 
 * This file provides centralized JDS API calls for customer journey data.
 * Requests are routed through a backend proxy to avoid CORS issues.
 */

// Global config for the module
let currentDatacenter = 'produs1'; // Default

/**
 * Sets the datacenter for JDS API calls (e.g., 'prodeu1', 'produs1')
 * Should be called from index.jsx or store initialization
 */
export const setJDSDataCenter = (dc) => {
  if (dc) {
    console.log(`[JDS API] Setting datacenter to: ${dc}`);
    currentDatacenter = dc;
  }
};

/**
 * Generate a GUID (Globally Unique Identifier)
 * @returns {string} GUID in format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
const generateGUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const toIsoUtc = (value) => {
  const date = value ? new Date(value) : new Date();
  return date.toISOString();
};

const toEpochMs = (value) => {
  const date = value ? new Date(value) : new Date();
  return date.getTime();
};

const buildCloudEvent = ({ type, identity, identitytype = 'customerId', source = 'task-management-widget', data, time }) => ({
  id: generateGUID(),
  specversion: '1.0',
  type,
  source,
  identity,
  identitytype,
  datacontenttype: 'application/json',
  time: toIsoUtc(time),
  eventTime: toEpochMs(time),
  data,
});

const computeGs1CheckDigit = (value17) => {
  if (!/^\d{17}$/.test(value17)) return null;

  let sum = 0;
  let multiplier = 3;
  for (let i = value17.length - 1; i >= 0; i--) {
    sum += Number(value17[i]) * multiplier;
    multiplier = multiplier === 3 ? 1 : 3;
  }

  return (10 - (sum % 10)) % 10;
};

export const publishCloudEvent = async (eventPayload, accessToken, workspaceId, datacenter) => {
  const baseUrl = getJDSBaseURL(datacenter);
  const endpoint = `${baseUrl}/publish/v1/api/event?workspaceId=${workspaceId}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
    },
    body: JSON.stringify(eventPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error ${response.status}: ${errorText}`);
  }

  return response.json();
};

/**
 * Get JDS REST API base URL
 * @param {string} [datacenter] - Optional datacenter identifier (e.g. "produs1", "prodeu1")
 * @returns {string} JDS REST API base URL
 */
export const getJDSBaseURL = (datacenter) => {
  // Use the provided datacenter or fallback to global/default
  const dc = datacenter || currentDatacenter || 'produs1';
  return `https://api-jds.wxdap-${dc}.webex.com`;
};

// Cache and workspace ID retrieval removed - workspaceId is now passed as parameter

/**
 * Get JDS GraphQL endpoint (direct - may have CORS issues)
 * @param {string} [datacenter] - Optional datacenter identifier (e.g. "produs1", "prodeu1")
 * @returns {string} JDS GraphQL endpoint URL
 */
const getJDSEndpoint = (datacenter) => {
  // Use the provided datacenter or fallback to global/default
  const dc = datacenter || currentDatacenter || 'produs1';
  return `https://api-jds.wxdap-${dc}.webex.com/graphql`;
};

/**
 * Search for a customer by phone number or email using aliases endpoint
 * @param {string} identity - Phone number or email address
 * @param {string} accessToken - JDS access token
 * @param {string} orgId - Organization ID
 * @param {string} datacenter - Datacenter identifier
 * @returns {Promise<Array>} Array of matching customers with basic info
 */
export const searchCustomerByIdentity = async (identity, accessToken, workspaceId, datacenter) => {
  if (!identity || !accessToken || !workspaceId) {
    console.error('searchCustomerByIdentity: Missing required parameters');
    return [];
  }

  try {

    // Call JDS aliases API - GET request with alias in URL path
    const baseUrl = getJDSBaseURL(datacenter);
    const encodedIdentity = encodeURIComponent(identity.trim());
    const endpoint = `${baseUrl}/admin/v1/api/person/workspace-id/${workspaceId}/aliases/${encodedIdentity}`;
    console.log('searchCustomerByIdentity: Calling', endpoint);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      },
    });

    if (!response.ok) {
      console.error('searchCustomerByIdentity: HTTP error', response.status);
      const errorText = await response.text();
      console.error('searchCustomerByIdentity: Error response:', errorText);
      return [];
    }

    const data = await response.json();
    console.log('searchCustomerByIdentity: Response data:', data);

    // The JDS API returns: { meta: {...}, data: [{...}, ...] }
    if (data.data && Array.isArray(data.data)) {
      return data.data.map(person => ({
        id: person.id || person.personId,
        firstName: person.firstName,
        lastName: person.lastName,
        name: `${person.firstName || ''} ${person.lastName || ''}`.trim(),
        email: person.email,
        phone: person.phone,
        customerId: person.customerId,
        address: person.address,
        externalId: person.externalId,
        createdAt: person.createdAt,
      }));
    }

    // Fallback: if response is array directly
    if (Array.isArray(data)) {
      return data.map(person => ({
        id: person.id || person.personId,
        firstName: person.firstName,
        lastName: person.lastName,
        name: `${person.firstName || ''} ${person.lastName || ''}`.trim(),
        email: person.email,
        phone: person.phone,
        customerId: person.customerId,
        address: person.address,
        externalId: person.externalId,
        createdAt: person.createdAt,
      }));
    }

    // Fallback: single result
    if (data.id || data.personId || data.firstName) {
      return [{
        id: data.id || data.personId,
        firstName: data.firstName,
        lastName: data.lastName,
        name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
        email: data.email,
        phone: data.phone,
        customerId: data.customerId,
        address: data.address,
        externalId: data.externalId,
        createdAt: data.createdAt,
      }];
    }

    return [];
  } catch (error) {
    console.error('searchCustomerByIdentity: Error', error);
    return [];
  }
};

/**
 * Fetch customer journey data from JDS
 * @param {string} customerId - Customer ID
 * @param {string} accessToken - JDS access token
 * @param {string} orgId - Organization ID
 * @param {string} datacenter - Datacenter identifier
 * @returns {Promise<Object>} Customer journey data with tasks and interactions
 */
export const fetchTaskManagement = async (customerId, accessToken, workspaceId, orgId, datacenter) => {
  if (!customerId || !accessToken || !workspaceId || !orgId) {
    console.error('fetchTaskManagement: Missing required parameters');
    return { customer: null, tasks: [] };
  }

  try {
    // Call JDS API directly
    const endpoint = getJDSEndpoint(datacenter);

    const query = `
      query GetCustomerJourney($customerId: ID!) {
        customer(id: $customerId) {
          id
          name
          email
          phone
          address
          externalId
          tasks(limit: 100) {
            id
            type
            status
            createdAt
            description
            interactions(limit: 100) {
              id
              taskId
              channel
              direction
              timestamp
              summary
              details
              duration
            }
          }
        }
      }
    `;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query,
        variables: { customerId, orgId },
      }),
    });

    if (!response.ok) {
      console.error('fetchTaskManagement: HTTP error', response.status);
      return { customer: null, tasks: [] };
    }

    const data = await response.json();

    if (data.errors) {
      console.error('fetchTaskManagement: GraphQL error', data.errors);
      return { customer: null, tasks: [] };
    }

    return {
      customer: data.data?.customer || null,
      tasks: data.data?.customer?.tasks || [],
    };
  } catch (error) {
    console.error('fetchTaskManagement: Error', error);
    return { customer: null, tasks: [] };
  }
};

/**
 * Fetch journey events/interactions for a customer
 * Uses JDS REST API to get customer events/activities
 * @param {string} customerId - Customer ID or identity (email/phone)
 * @param {string} accessToken - JDS access token
 * @param {string} datacenter - Datacenter identifier
 * @returns {Promise<Array>} Array of events/interactions
 */
export const fetchJourneyEvents = async (identity, accessToken, workspaceId, datacenter, additionalFilter = null, maxPages = 20) => {
  // Accept a single identity string, an array, or null/[] for type-only workspace queries.
  const identities = (Array.isArray(identity) ? identity : [identity])
    .map(i => String(i || '').trim())
    .filter(Boolean);

  // Require at least an identity OR an additionalFilter (type-only workspace query).
  if (!accessToken || !workspaceId || (identities.length === 0 && !additionalFilter)) {
    console.error('fetchJourneyEvents: Must provide identity or additionalFilter (type filter)');
    return [];
  }

  try {
    const baseUrl = getJDSBaseURL(datacenter);
    // GET /v1/api/events/workspace-id/{workspaceId}?identity=<primary>
    // Using the ?identity= parameter (NOT ?filter=identity==) so JDS applies its
    // cross-identity graph and returns events for ALL linked identities automatically
    // (e.g. querying by email also returns events stored under linked phone numbers).
    // The ?filter=identity== RSQL approach only matches the exact identity string and
    // does NOT traverse the identity graph, causing phone events to be missing.
    // When identities is empty, no identity param is added — returns workspace-wide
    // results filtered only by the additionalFilter type constraint.

    // Prefer email identity as primary (more stable in JDS graph); fall back to first.
    const primaryIdentity = identities.find((id) => id.includes('@')) || identities[0] || null;

    let allEvents = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;
    const pageLimit = maxPages;

    // Build query string: single ?identity= for cross-identity graph lookup.
    // URLSearchParams handles percent-encoding — do NOT pre-encode the identity value
    // or the % signs themselves get double-encoded (%40 → %2540, %2B → %252B).
    const buildQuery = (pg) => {
      const params = new URLSearchParams();
      if (primaryIdentity) params.set('identity', primaryIdentity);
      if (additionalFilter) params.append('filter', additionalFilter);
      params.set('page', String(pg));
      params.set('pageSize', String(pageSize));
      return params.toString();
    };

    while (hasMore) {
        const url = `${baseUrl}/v1/api/events/workspace-id/${workspaceId}?${buildQuery(page)}`;
        console.log('fetchJourneyEvents: Calling', url, 'page', page);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site',
          },
        });

        if (!response.ok) {
          console.error(`fetchJourneyEvents: HTTP error ${response.status} on page ${page}`);
          hasMore = false; 
          break;
        }

        const data = await response.json();
        
        let pageData = [];
        // Transform response to events array
        if (data.data && Array.isArray(data.data)) {
           pageData = data.data.map(event => ({
            id: event.id,
            identity: event.identity || identity,
            type: event.type || event.channel || event.eventType,
            channel: event.channel || event.channelType,
            direction: event.direction,
            timestamp: event.timestamp || event.createdAt || event.eventTime,
            createdAt: event.createdAt,
            summary: event.summary || event.subject || event.title,
            details: event.details || event.description || event.body,
            duration: event.duration,
            status: event.status,
            taskId: event.taskId || (event.data && event.data.taskId),
            raw: event,
            data: event.data || {}
           }));
        } else if (Array.isArray(data)) {
           pageData = data.map(event => ({
            id: event.id,
            identity: event.identity || identity,
            type: event.type || event.channel || event.eventType,
            channel: event.channel || event.channelType,
            direction: event.direction,
            timestamp: event.timestamp || event.createdAt || event.eventTime,
            createdAt: event.createdAt,
            summary: event.summary || event.subject || event.title,
            details: event.details || event.description || event.body,
            duration: event.duration,
            status: event.status,
            taskId: event.taskId || (event.data && event.data.taskId),
            raw: event,
            data: event.data || {}
           }));
        }

        if (pageData.length === 0) {
            hasMore = false;
        } else {
            allEvents = [...allEvents, ...pageData];
            if (pageData.length < pageSize) hasMore = false;
            else page++;
            
            if (page > pageLimit) {
                console.warn(`fetchJourneyEvents: Reached page limit (${pageLimit})`);
                hasMore = false;
            }
        }
    }
    
    // Deduplicate events by id in case multiple identities share events
    const seen = new Set();
    allEvents = allEvents.filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    console.log(`fetchJourneyEvents: Retrieved ${allEvents.length} total events (primary identity: ${primaryIdentity}, input identities: [${identities.join(', ')}])`);
    // Debug: show distinct identity values in response
    if (allEvents.length > 0) {
      const distinctIds = [...new Set(allEvents.map(e => e.raw?.identity || e.identity).filter(Boolean))];
      console.log('fetchJourneyEvents: Distinct identities in response:', distinctIds);
    }
    return allEvents;
  } catch (error) {
    console.error('fetchJourneyEvents: Error', error);
    return [];
  }
};

/**
 * Search for lead customers in JDS
 * @param {Object} criteria - Search criteria
 * @param {string} accessToken - OAuth access token
 * @param {string} orgId - Organization ID
 * @param {string} datacenter - Datacenter identifier
 * @returns {Promise<Array>} Array of lead customers
 */
export const searchLeadCustomers = async (criteria, accessToken, workspaceId, orgId, datacenter) => {
  if (!criteria || !accessToken || !workspaceId || !orgId) {
    console.error('searchLeadCustomers: Missing required parameters');
    return [];
  }

  const query = `
    query SearchLeads($criteria: SearchCriteria!, $orgId: String!) {
      searchCustomers(criteria: $criteria, orgId: $orgId) {
        id
        name
        email
        phone
        leadScore
        reason
        suggestedTopic
        lastInteraction {
          timestamp
          channel
          summary
        }
      }
    }
  `;

  try {
    // Call JDS API directly
    const endpoint = getJDSEndpoint(datacenter);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query,
        variables: { criteria, orgId },
      })
    });

    if (!response.ok) {
      throw new Error(`Proxy request failed with status: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.warn('GraphQL warning:', result.errors[0].message);
      return []; // Return empty array on error
    }

    return result.data?.searchCustomers || [];
  } catch (error) {
    console.error('searchLeadCustomers error:', error);
    return []; // Return empty array on error
  }
};

/**
 * Save new interaction to JDS
 * @param {Object} interaction - Interaction data
 * @param {string} accessToken - OAuth access token
 * @param {string} orgId - Organization ID
 * @param {string} datacenter - Datacenter identifier
 * @returns {Promise<Object>} Created interaction
 */
export const saveInteraction = async (interaction, accessToken, workspaceId, orgId, datacenter) => {
  if (!interaction || !accessToken || !workspaceId || !orgId) {
    console.error('saveInteraction: Missing required parameters');
    return null;
  }

  const mutation = `
    mutation CreateInteraction($input: InteractionInput!, $orgId: String!) {
      createInteraction(input: $input, orgId: $orgId) {
        id
        taskId
        channel
        direction
        timestamp
        summary
        details
      }
    }
  `;

  try {
    // Call JDS API directly
    const endpoint = getJDSEndpoint(datacenter);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: mutation,
        variables: { input: interaction, orgId },
      })
    });

    if (!response.ok) {
      throw new Error(`Proxy request failed with status: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL error: ${result.errors[0].message}`);
    }

    return result.data?.createInteraction || null;
  } catch (error) {
    console.error('saveInteraction error:', error);
    throw error;
  }
};

// ============================================================================
// IDENTITY AND ADDRESS MANAGEMENT
// ============================================================================

/**
 * Update customer identity fields
 * @param {string} personId - Person/Customer ID
 * @param {Object} updates - Fields to update (firstName, lastName, email, phone, customerId, etc.)
 * @param {string} accessToken - JDS access token
 * @param {string} datacenter - Datacenter identifier
 * @returns {Promise<Object>} Updated identity
 */

export const patchIdentity = async (personId, patchOperations, accessToken, workspaceId, datacenter) => {  if (!personId || !patchOperations || !accessToken || !workspaceId) {
    throw new Error('Missing required parameters for patchIdentity');
  }

  const baseUrl = getJDSBaseURL(datacenter);
  const endpoint = `${baseUrl}/admin/v1/api/person/workspace-id/${workspaceId}/person-id/${personId}`;

  console.log('patchIdentity: Updating fields with JSON Patch:', JSON.stringify(patchOperations));

  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json-patch+json',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
    },
    body: JSON.stringify(patchOperations),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  console.log('patchIdentity: Fields updated successfully');
  return result;
};

export const updateIdentity = async (personId, updates, accessToken, workspaceId, datacenter) => {
  if (!personId || !updates || !accessToken || !workspaceId) {
    throw new Error('Missing required parameters for updateIdentity');
  }

  // Legacy support or simple field updates wrapper
  // If 'updates' is an array, treat it as raw patch operations
  if (Array.isArray(updates)) {
    return patchIdentity(personId, updates, accessToken, workspaceId, datacenter);
  }

  // Otherwise, if it's the old "updates" object, warn and defer to patchIdentity
  // But we can't easily diff here without old state. 
  // So we'll assume this is only called by code that we are about to refactor.
  // For now, let's keep the old behavior but warn?
  
  // Actually, let's just use the old logic for now just in case, but we are moving to patchIdentity.
  // The user wants to FIX the issue. The issue is strictly in HOW the patch is constructed.
  // So I will LEAVE updateIdentity as is (or minimal fix) but mostly rely on modifyIdentity changes.
  
  // Re-implementing updateIdentity to use patchIdentity for simple fields (backward compat)
  
  const patchOperations = [];
  
  if (updates.firstName !== undefined) {
      patchOperations.push({ op: 'add', path: '/firstName', value: updates.firstName });
  }
  if (updates.lastName !== undefined) {
      patchOperations.push({ op: 'add', path: '/lastName', value: updates.lastName });
  }
  if (updates.email !== undefined) {
      patchOperations.push({ op: 'add', path: '/email', value: updates.email });
  }
  if (updates.emails !== undefined) { // Support legacy prop name just in case
      patchOperations.push({ op: 'add', path: '/email', value: updates.emails });
  }
  if (updates.phone !== undefined) {
      patchOperations.push({ op: 'add', path: '/phone', value: updates.phone });
  }

  // Address Management Support
  if (updates.addCustomerId !== undefined) {
      // Add a specific customerId to the end of the array
      patchOperations.push({ op: 'add', path: '/customerId/-', value: updates.addCustomerId });
  }
  if (updates.removeCustomerIdPath !== undefined) {
      // Remove specific customerId by path (e.g., /customerId/2)
      patchOperations.push({ op: 'remove', path: updates.removeCustomerIdPath });
  }
  
  return patchIdentity(personId, patchOperations, accessToken, workspaceId, datacenter);
};

/**
 * Fetch person/customer data by ID
 * @param {string} personId - Person/Customer ID
 * @param {string} accessToken - JDS access token
 * @param {string} datacenter - Datacenter identifier
 * @returns {Promise<Object>} Person data
 */
export const fetchPersonById = async (personId, accessToken, workspaceId, datacenter) => {
  if (!personId || !accessToken || !workspaceId) {
    throw new Error('Missing required parameters for fetchPersonById');
  }
  // fetchPersonById legitimately uses the MongoDB ObjectId
  if (!/^[0-9a-f]{24}$/i.test(personId)) {
    throw new Error(`fetchPersonById: Invalid personId "${personId}" — must be MongoDB ObjectId`);
  }

  try {

    const baseUrl = getJDSBaseURL(datacenter);
    const endpoint = `${baseUrl}/admin/v1/api/person/workspace-id/${workspaceId}?personId=${personId}`;

    console.log('fetchPersonById: Calling', endpoint);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('fetchPersonById: Success', result);

    // Parse response - data is an array with one person object
    let personData = result.data || result;
    if (Array.isArray(personData) && personData.length > 0) {
      personData = personData[0];
    }

    console.log('fetchPersonById: Parsed person:', personData);

    // Return normalized data
    return {
      id: personData.id || personId,
      firstName: personData.firstName || '',
      lastName: personData.lastName || '',
      name: `${personData.firstName || ''} ${personData.lastName || ''}`.trim() || 'Customer',
      email: personData.email || [],
      phone: personData.phone || [],
      emails: personData.email?.map(email => ({ address: email, type: 'work' })) || [],
      phoneNumbers: personData.phone?.map(phone => ({ number: phone, type: 'mobile' })) || [],
      customerId: personData.customerId || [],
    };
  } catch (error) {
    console.error('fetchPersonById error:', error);
    throw error;
  }
};

/**
 * Create an address as a JDS Event (referenced in identity's customerId array)
 * @param {string} identity - Customer identity (email/phone)
 * @param {Object} addressData - Address information with GPS coordinates
 * @param {string} accessToken - JDS access token
 * @param {string} datacenter - Datacenter identifier
 * @returns {Promise<Object>} Created address event
 */
export const createAddress = async (identity, addressData, accessToken, workspaceId, datacenter) => {
  if (!identity || !addressData || !accessToken || !workspaceId) {
    throw new Error('Missing required parameters for createAddress');
  }

  try {

    const baseUrl = getJDSBaseURL(datacenter);
    const endpoint = `${baseUrl}/publish/v1/api/event?workspaceId=${workspaceId}`;

    // Generate GUIDs
    const eventId = generateGUID();
    const addressIdentity = generateGUID();

    // Create event with comprehensive address data
    const eventPayload = {
      id: eventId,
      specversion: '1.0',
      type: 'address:created',
      source: 'task-management-widget',
      identity: addressIdentity,
      identitytype: 'customerId',
      datacontenttype: 'application/json',
      data: {
        type: 'address',
        // Core address components
        streetName: addressData.streetName || '',
        streetNumber: addressData.streetNumber || '',
        premise: addressData.premise || '',
        neighborhood: addressData.neighborhood || '',
        city: addressData.city || '',
        postalTown: addressData.postalTown || '',
        postalCode: addressData.postalCode || addressData.zipCode || '',
        region: addressData.region || addressData.state || '',
        country: addressData.country || '',
        // Fallback and reference
        formattedAddress: addressData.formattedAddress || '',
        googlePlaceId: addressData.googlePlaceId || '',
        // Location
        latitude: addressData.latitude || null,
        longitude: addressData.longitude || null,
        // Metadata
        label: addressData.label || 'home',
        isPrimary: addressData.isPrimary || false,
      },
    };

    console.log('createAddress: Calling', endpoint, 'with payload:', eventPayload);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      },
      body: JSON.stringify(eventPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('createAddress: Success', result);

    // Return formatted address with both IDs
    return {
      id: addressIdentity,
      eventId: eventId,
      ...addressData,
    };
  } catch (error) {
    console.error('createAddress error:', error);
    throw error;
  }
};

/**
 * Update an existing address event
 * @param {string} identity - Customer identity
 * @param {string} addressId - Address event ID
 * @param {Object} addressData - Updated address information
 * @param {string} accessToken - JDS access token
 * @param {string} datacenter - Datacenter identifier
 * @returns {Promise<Object>} Updated address
 */
export const updateAddress = async (identity, addressId, addressData, accessToken, workspaceId, datacenter) => {
  if (!identity || !addressId || !addressData || !accessToken || !workspaceId) {
    throw new Error('Missing required parameters for updateAddress');
  }

  try {

    const baseUrl = getJDSBaseURL(datacenter);
    const endpoint = `${baseUrl}/publish/v1/api/event?workspaceId=${workspaceId}`;

    // Create event with SAME identity to represent updated address fields
    const eventId = generateGUID();
    const eventPayload = {
      id: eventId,
      specversion: '1.0',
      type: 'address:created',
      source: 'task-management-widget',
      identity: addressId, // preserve identity so latest event wins
      identitytype: 'customerId',
      datacontenttype: 'application/json',
      data: {
        type: 'address',
        // Core address components
        streetName: addressData.streetName || addressData.street || '',
        streetNumber: addressData.streetNumber || '',
        premise: addressData.premise || '',
        neighborhood: addressData.neighborhood || '',
        city: addressData.city || '',
        postalTown: addressData.postalTown || '',
        postalCode: addressData.postalCode || addressData.zipCode || '',
        region: addressData.region || addressData.state || '',
        country: addressData.country || '',
        // Fallback and reference
        formattedAddress: addressData.formattedAddress || '',
        googlePlaceId: addressData.googlePlaceId || '',
        // Location
        latitude: addressData.latitude ?? null,
        longitude: addressData.longitude ?? null,
        // Metadata
        label: addressData.label || 'home',
        isPrimary: !!addressData.isPrimary,
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      },
      body: JSON.stringify(eventPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return {
      id: addressId,
      eventId: eventId,
      ...addressData,
    };
  } catch (error) {
    console.error('updateAddress error:', error);
    throw error;
  }
};

/**
 * Fetch all addresses for a customer from JDS events
 * @param {string} personId - Person/Customer ID from identity record
 * @param {Array<string>} customerIds - Array of customerId values from identity.customerId
 * @param {string} accessToken - JDS access token
 * @param {string} datacenter - Datacenter identifier
 * @returns {Promise<Array>} Array of addresses
 */
export const fetchAddresses = async (personId, customerIds, accessToken, workspaceId, datacenter) => {
  try {
    if (!personId || !accessToken || !workspaceId) {
      console.log('fetchAddresses: Missing required parameters');
      return [];
    }
    // personId MUST be a MongoDB ObjectId (24 hex characters)
    if (!/^[0-9a-f]{24}$/i.test(personId)) {
      console.error(`fetchAddresses: Refusing call — personId "${personId}" is not a MongoDB ObjectId`);
      return [];
    }

    const baseUrl = getJDSBaseURL(datacenter);
    const endpoint = `${baseUrl}/v1/api/events/workspace-id/${workspaceId}?personId=${personId}&filter=type=='address:created'`;

    console.log('fetchAddresses: Calling', endpoint);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const events = result.data || result.events || [];

    console.log('fetchAddresses: Success, found', events.length, 'address events');
    console.log('fetchAddresses: customerIds to filter:', customerIds);

    // Filter events by customerId array if provided
    const filteredEvents = customerIds && customerIds.length > 0
      ? events.filter(event => {
        const matches = event.identitytype === 'customerId' && customerIds.includes(event.identity);
        if (matches) {
          console.log('fetchAddresses: Matched event with identity:', event.identity);
        }
        return matches;
      })
      : events.filter(event => event.identitytype === 'customerId');

    console.log('fetchAddresses: Filtered to', filteredEvents.length, 'events matching customerId array');

    // Collapse events to latest per identity
    const latestByIdentity = new Map();
    for (const ev of filteredEvents) {
      if (ev.data?.type !== 'address') continue;
      const prev = latestByIdentity.get(ev.identity);
      if (!prev || (ev.time && prev.time && new Date(ev.time) > new Date(prev.time))) {
        latestByIdentity.set(ev.identity, ev);
      }
    }

    // Transform collapsed events to address objects
    const addresses = Array.from(latestByIdentity.values()).map(event => ({
      id: event.identity,
      eventId: event.id,
      // Core address components
      streetName: event.data.streetName || '',
      streetNumber: event.data.streetNumber || '',
      premise: event.data.premise || '',
      neighborhood: event.data.neighborhood || '',
      city: event.data.city || '',
      postalTown: event.data.postalTown || '',
      postalCode: event.data.postalCode || event.data.zipCode || '',
      region: event.data.region || event.data.state || '',
      country: event.data.country || '',
      // Fallback and reference
      formattedAddress: event.data.formattedAddress || '',
      googlePlaceId: event.data.googlePlaceId || '',
      // Location
      latitude: event.data.latitude,
      longitude: event.data.longitude,
      // Metadata
      label: event.data.label || 'Home',
      isPrimary: event.data.isPrimary || false,
      timestamp: event.time,
    }));

    return addresses;
  } catch (error) {
    console.error('fetchAddresses error:', error);
    return [];
  }
};

const resolveEventTime = (event) => {
  if (event?.time) return new Date(event.time).getTime();
  if (event?.eventTime) return Number(event.eventTime);
  if (event?.timestamp) return new Date(event.timestamp).getTime();
  if (event?.createdAt) return new Date(event.createdAt).getTime();
  return 0;
};

// ============================================================================
// TASK AND RECORD MANAGEMENT
// ============================================================================

/**
 * Create a new task
 * @param {string} customerId - Customer ID
 * @param {Object} taskData - Task information (name, description, type, status)
 * @param {string} accessToken - JDS access token
 * @param {string} datacenter - Datacenter identifier
 * @returns {Promise<Object>} Created task
 */
export const createTask = async (customerId, taskData, accessToken, workspaceId, datacenter) => {
  if (!customerId || !taskData || !accessToken || !workspaceId) {
    throw new Error('Missing required parameters for createTask');
  }

  try {

    const baseUrl = getJDSBaseURL(datacenter);
    const endpoint = `${baseUrl}/publish/v1/api/event?workspaceId=${workspaceId}`;

    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create event for task
    const eventPayload = {
      data: {
        taskId: taskId,
        type: 'task',
        name: taskData.name || 'New Task',
        description: taskData.description || '',
        taskType: taskData.type || 'general',
        status: taskData.status || 'open',
        priority: taskData.priority || 'medium',
        assignedTo: taskData.assignedTo || null,
      },
      datacontenttype: 'application/json',
      id: taskId,
      person: customerId,
      source: 'task-management-widget',
      specversion: '1.0',
      time: new Date().toISOString(),
      type: 'task:created',
    };

    console.log('createTask: Calling', endpoint, 'with payload:', eventPayload);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      },
      body: JSON.stringify(eventPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('createTask: Success', result);

    return {
      id: taskId,
      ...taskData,
      createdAt: new Date().toISOString(),
      interactions: [],
    };
  } catch (error) {
    console.error('createTask error:', error);
    throw error;
  }
};

/**
 * Create a task record/interaction
 * @param {string} customerId - Customer ID
 * @param {string} taskId - Task ID to associate with
 * @param {Object} recordData - Record information
 * @param {string} accessToken - JDS access token
 * @param {string} datacenter - Datacenter identifier
 * @returns {Promise<Object>} Created record
 */
export const createTaskRecord = async (customerId, taskId, recordData, accessToken, workspaceId, datacenter) => {
  if (!customerId || !taskId || !recordData || !accessToken || !workspaceId) {
    throw new Error('Missing required parameters for createTaskRecord');
  }

  try {

    const baseUrl = getJDSBaseURL(datacenter);
    const endpoint = `${baseUrl}/publish/v1/api/event?workspaceId=${workspaceId}`;

    const recordId = `record-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create event for task record
    const eventPayload = {
      data: {
        taskId: taskId, // Link to parent task
        recordId: recordId,
        type: 'task-record',
        channel: recordData.channel || 'manual',
        direction: recordData.direction || 'outbound',
        summary: recordData.summary || '',
        details: recordData.details || '',
        interactionId: recordData.interactionId || null, // Link to WebexCC interaction if available
      },
      datacontenttype: 'application/json',
      id: recordId,
      person: customerId,
      source: recordData.source || 'task-management-widget',
      specversion: '1.0',
      time: recordData.timestamp || new Date().toISOString(),
      type: 'task:record:created',
    };

    console.log('createTaskRecord: Calling', endpoint, 'with payload:', eventPayload);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      },
      body: JSON.stringify(eventPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('createTaskRecord: Success', result);

    return {
      id: recordId,
      taskId: taskId,
      ...recordData,
      timestamp: eventPayload.time,
    };
  } catch (error) {
    console.error('createTaskRecord error:', error);
    throw error;
  }
};

/**
 * Fetch all tasks and their records for a customer
 * @param {string} customerId - Customer ID or identity
 * @param {string} accessToken - JDS access token
 * @param {string} datacenter - Datacenter identifier
 * @returns {Promise<Array>} Array of tasks with nested records
 */
export const fetchTasksWithRecords = async (customerId, accessToken, workspaceId, datacenter) => {
  if (!customerId || !accessToken || !workspaceId) {
    console.error('fetchTasksWithRecords: Missing required parameters');
    return [];
  }

  try {

    const baseUrl = getJDSBaseURL(datacenter);
    const encodedIdentity = encodeURIComponent(customerId);
    const endpoint = `${baseUrl}/v1/journey/streams/${workspaceId}?identity=${encodedIdentity}`;

    console.log('fetchTasksWithRecords: Calling', endpoint);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('fetchTasksWithRecords: Success', result);

    const events = result.events || [];

    // Separate tasks and records
    const taskEvents = events.filter(e => e.type === 'task:created' || e.data?.type === 'task');
    const recordEvents = events.filter(e => e.type === 'task:record:created' || e.data?.type === 'task-record');

    // Build task hierarchy
    const tasks = taskEvents.map(taskEvent => {
      const taskId = taskEvent.data?.taskId || taskEvent.id;
      const taskRecords = recordEvents
        .filter(r => r.data?.taskId === taskId)
        .map(r => ({
          id: r.data?.recordId || r.id,
          taskId: taskId,
          channel: r.data?.channel,
          direction: r.data?.direction,
          summary: r.data?.summary,
          details: r.data?.details,
          timestamp: r.time,
          interactionId: r.data?.interactionId,
        }))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      return {
        id: taskId,
        type: taskEvent.data?.name || taskEvent.data?.taskType || 'Task',
        name: taskEvent.data?.name,
        description: taskEvent.data?.description,
        status: taskEvent.data?.status || 'open',
        priority: taskEvent.data?.priority,
        assignedTo: taskEvent.data?.assignedTo,
        createdAt: taskEvent.time,
        interactions: taskRecords,
      };
    });

    return tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    console.error('fetchTasksWithRecords error:', error);
    return [];
  }
};

let streamAbortController = null;

/**
 * Subscribe to real-time customer events via HTTP/2 Server-Sent Events (SSE)
 * @param {string} identity - Customer identity to listen for
 * @param {string} accessToken - OAuth access token
 * @param {string} workspaceId - Workspace ID
 * @param {string} datacenter - Datacenter identifier (optional/implied)
 * @param {Function} onEvent - Callback for new events
 * @param {Function} onError - Callback for errors
 * @returns {Function} Unsubscribe function
 */
export const subscribeToCustomerEvents = (identity, accessToken, workspaceId, datacenter, onEvent, onError) => {
  if (!identity || !accessToken || !workspaceId) {
    console.error('subscribeToCustomerEvents: Missing required parameters');
    return () => { };
  }

  // Abort existing stream if any
  if (streamAbortController) {
    try {
      streamAbortController.abort();
    } catch (e) {
      // Ignore
    }
  }

  streamAbortController = new AbortController();
  const signal = streamAbortController.signal;

  const baseUrl = getJDSBaseURL(datacenter);
  const endpoint = `${baseUrl}/v1/api/events/stream/workspace-id/${workspaceId}/identity`;

  console.log('subscribeToCustomerEvents: Connecting to', endpoint, 'for identity:', identity);

  // Exponential-backoff reconnect: 2s → 4s → 8s → … capped at 60s
  const SSE_RETRY_BASE_MS = 2000;
  const SSE_RETRY_MAX_MS = 60000;
  let sseRetryDelay = SSE_RETRY_BASE_MS;

  const startStream = async () => {
    // Abort guard — stop reconnecting once the caller has unsubscribed
    if (!streamAbortController || signal.aborted) return;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ identity }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`SSE Stream HTTP error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('SSE Stream response has no body');
      }

      // Successful connection — reset backoff counter
      sseRetryDelay = SSE_RETRY_BASE_MS;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('SSE Stream closed by server');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Split buffer into lines
        const lines = buffer.split('\n');
        // Keep the last partial line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          // SSE format: "data: {...}"
          if (trimmedLine.startsWith('data:')) {
            const dataStr = trimmedLine.substring(5).trim();
            if (dataStr) {
              try {
                const eventData = JSON.parse(dataStr);
                console.log('SSE Event received:', eventData);
                if (onEvent) onEvent(eventData);
              } catch (e) {
                console.warn('Failed to parse SSE data:', trimmedLine, e);
              }
            }
          }
          // Handle other SSE fields if needed (event, id, retry)
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('SSE Stream aborted manually');
        return; // Do not reconnect after an explicit unsubscribe
      }
      console.error('SSE Stream error:', error);
      if (onError) onError(error);
    }

    // Reconnect with exponential backoff unless the stream was intentionally aborted
    if (streamAbortController && !signal.aborted) {
      console.log(`SSE Stream reconnecting in ${sseRetryDelay}ms…`);
      setTimeout(startStream, sseRetryDelay);
      sseRetryDelay = Math.min(sseRetryDelay * 2, SSE_RETRY_MAX_MS);
    }
  };

  startStream();

  // Return unsubscribe function
  return () => {
    console.log('subscribeToCustomerEvents: Unsubscribing...');
    if (streamAbortController) {
      streamAbortController.abort();
      streamAbortController = null;
    }
  };
};

/**
 * Fetch task/interaction summary from AI service
 * @param {string} orgId - Organization ID
 * @param {string} taskId - Task/Interaction ID
 * @param {string} datacenter - Datacenter identifier
 * @param {string} accessToken - OAuth access token
 * @returns {Promise<Object>} Summary object or null
 */
export const getTaskSummary = async (orgId, taskId, datacenter, accessToken) => {
  if (!datacenter || !orgId || !taskId) return null;

  const url = `https://api-ai-assistant.${datacenter}.ciscoccservice.com/summary/list`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        orgId: orgId,
        interactionId: taskId,
        searchType: 'INTERACTION'
      })
    });

    if (!response.ok) {
      // Just warn, don't throw, as summaries might not exist or be ready
      console.warn(`[API] Failed to fetch summary for ${taskId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    // Parse response structure: {"summaries":{"POST_CALL":{"<key>":{...}}}}
    if (data?.summaries?.POST_CALL) {
      const summaries = data.summaries.POST_CALL;
      // The key is dynamic (includes org/interaction ids), so get the first value
      const key = Object.keys(summaries)[0];
      if (key) return summaries[key];
    }
    return null;
  } catch (error) {
    console.error('[API] Error fetching task summary:', error);
    return null;
  }
};

/**
 * Create an agent-initiated digital (social) outbound task via the Webex CC
 * Digital Flow Manager — the same endpoint the native "digital outbound" widget
 * uses for SMS / WhatsApp.
 *
 * This is NOT a telephony outdial: digital channels must go through DigitalFM
 * (`resolveTask`), not the dialer `/v1/tasks` endpoint (which only accepts
 * telephony entry points and rejects social entry-point IDs).
 *
 * On success Webex CC routes the new task back to the initiating agent; the
 * caller is expected to accept it (e.g. via `Desktop.agentContact.accept`).
 *
 * @param {object} params
 * @param {string} params.entryPointId  - Digital (social) entry point ID
 * @param {string} params.destination   - Customer number, E.164 (e.g. +420602376247)
 * @param {string} params.mediaChannel  - 'sms' | 'whatsapp'
 * @param {string} [params.origin]      - Sender channel address (ANI)
 * @param {object} config
 * @param {string} config.accessToken   - Webex CC desktop access token
 * @param {string} config.orgId         - Organization ID
 * @param {string} config.datacenter    - Datacenter identifier (e.g. prodeu1)
 * @returns {Promise<string>} The created task/interaction ID
 * @throws {Error} On missing config or non-2xx response
 */
export const resolveDigitalOutboundTask = async (
  { entryPointId, destination, mediaChannel, origin },
  { accessToken, orgId, datacenter },
) => {
  if (!datacenter) throw new Error('resolveDigitalOutboundTask: datacenter is required');
  if (!entryPointId) throw new Error('resolveDigitalOutboundTask: entryPointId is required');
  if (!destination) throw new Error('resolveDigitalOutboundTask: destination is required');

  const url = `https://digitalfm.${datacenter}.ciscoccservice.com/digitalfm/v1/resolveTask`;

  const body = {
    entryPointId,
    destination,
    mediaType: 'social',
    mediaChannel,
    direction: 'OUTBOUND',
    outboundType: 'OUTDIAL',
    orgId: orgId || '',
    ...(origin ? { origin } : {}),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errJson = await response.json();
      detail = errJson?.errorMessage || errJson?.errorData || '';
    } catch { /* non-JSON error body */ }
    throw new Error(detail || `DigitalFM resolveTask failed with status ${response.status}`);
  }

  const data = await response.json();
  const taskId = data?.data?.id;
  if (!taskId) {
    throw new Error('DigitalFM resolveTask returned no task ID');
  }
  return taskId;
};

const TICKET_DB_BASE_URL = 'https://6a257cdd5447714a6f837a74.mockapi.io/helpdesk';
const CUSTOMER_DB_BASE_URL = 'https://6a257cdd5447714a6f837a74.mockapi.io/customerdata';

const getCadValue = (task, key) => {
  if (!task || !key) return null;
  return task.callAssociatedData?.[key]?.value || task.callAssociatedDetails?.[key] || null;
};

export const normalizeTaskPayload = (task = {}) => {
  const derivedCaseId =
    task.caseId ||
    task.caseid ||
    getCadValue(task, 'caseId') ||
    getCadValue(task, 'Case ID') ||
    null;

  // Only check explicit task type sources, NOT task.type (which is the event type)
  const normalizedTaskType = String(
    task.taskType ||
    getCadValue(task, 'taskType') ||
    getCadValue(task, 'Task Type') ||
    '',
  ).toLowerCase();
  const inferredTaskType = normalizedTaskType || (derivedCaseId ? 'case' : '');

  return {
    raw: task,
    taskType: inferredTaskType,
    caseId: derivedCaseId || task.name || null,
    taskId: task.taskId || task.id || null,
    customerEmail:
      task.customerEmail ||
      task.caseuseremail ||
      task.email ||
      getCadValue(task, 'customerEmail') ||
      getCadValue(task, 'dn') ||
      task.dnis ||
      null,
    customerPhone:
      task.customerPhone ||
      task.casephone ||
      task.phone ||
      task.ani ||
      getCadValue(task, 'ani') ||
      null,
    customerId: task.customerId || null,
    customerName: task.customerName || task.caseuser || getCadValue(task, 'customerName') || null,
    conversationId: task.conversationId || null,
    jdsWorkspaceId: task.JDSWorkspaceId || task.jdsWorkspaceId || null,
  };
};

const normalizeCaseRecord = (record) => {
  if (!record) return null;

  return {
    id: record.id || record.caseId || record.name,
    caseId: record.name || record.caseId || record.id,
    title: record.case || record.name || '',
    description: record.casedescription || '',
    status: record.casestatus || 'open',
    customerName: record.caseuser || '',
    customerEmail: record.caseuseremail || '',
    customerPhone: record.casephone || '',
    owner: record.caseowner || '',
    assetId: record.AssetId || '',
    createdAt: record.createdAt || record.casedate || '',
    appointmentDate: record.caseappointmentdate || '',
    appointmentTime: record.caseappointmenttime || '',
    notes: record.Data1 || '',
    customData: {
      Data2: record.Data2 || '',
      Data3: record.Data3 || '',
      Data4: record.Data4 || '',
      Data5: record.Data5 || '',
    },
    source: 'ticket-db',
    raw: record,
  };
};

const normalizeCustomerRecord = (record) => {
  if (!record) return null;

  return {
    id: record.id,
    customerId: record.customerId || record.account || record.id,
    firstName: record.firstName || '',
    lastName: record.lastName || '',
    name: record.name || `${record.firstName || ''} ${record.lastName || ''}`.trim(),
    email: record.email || '',
    phone: record.phone || record.mobile || '',
    city: record.city || '',
    street: record.street || record.adress || '',
    postalCode: record.postalCode || record.postcode || '',
    country: record.country || '',
    source: 'customer-db',
    raw: record,
  };
};

const buildTicketHistory = (caseRecord) => {
  if (!caseRecord) return [];

  const events = [];

  events.push({
    id: `ticket-${caseRecord.id || caseRecord.caseId}-created`,
    source: 'ticket-db',
    interactionType: 'task',
    timestamp: caseRecord.createdAt || new Date().toISOString(),
    title: 'Case loaded',
    summary: `${caseRecord.caseId || caseRecord.id} (${caseRecord.status})`,
    details: caseRecord.description || '',
  });

  if (caseRecord.notes) {
    events.push({
      id: `ticket-${caseRecord.id || caseRecord.caseId}-note`,
      source: 'ticket-db',
      interactionType: 'task',
      timestamp: caseRecord.createdAt || new Date().toISOString(),
      title: 'Case notes',
      summary: caseRecord.notes,
      details: 'Notes from ticket database',
    });
  }

  return events;
};

const normalizeJdsEvent = (event) => {
  const eventData = event?.data || {};
  const interactionType = String(eventData.channel || eventData.type || event.type || 'task').toLowerCase();
  const summary = eventData.summary || eventData.description || eventData.status || event.subject || '';

  return {
    id: event.id || event.eventId || generateGUID(),
    source: 'jds',
    interactionType,
    timestamp: event.time || event.eventTime || eventData.timestamp || new Date().toISOString(),
    title: event.type || eventData.type || 'JDS interaction',
    summary,
    details: eventData.details || eventData.message || JSON.stringify(eventData),
    raw: event,
  };
};

const mergeHistory = (ticketHistory, jdsHistory) => {
  const combined = [...ticketHistory, ...jdsHistory];

  return combined
    .filter(item => Boolean(item?.timestamp))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export const resolveWorkspaceForTaskType = (taskType, defaultWorkspaceId, taskWorkspaceId, overrideTaskTypes = []) => {
  const normalizedType = String(taskType || '').toLowerCase();
  const normalizedOverrides = (overrideTaskTypes || []).map(item => String(item || '').toLowerCase());

  if (taskWorkspaceId && normalizedOverrides.includes(normalizedType)) {
    return taskWorkspaceId;
  }

  return defaultWorkspaceId;
};

export const fetchCaseByIdFromTicketDB = async (caseId) => {
  if (!caseId) {
    console.warn('[Case Fetch] No caseId provided');
    return null;
  }

  try {
    const url = `${TICKET_DB_BASE_URL}?name=${encodeURIComponent(caseId)}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn('[Case Fetch] API returned non-ok status:', response.status);
      return null;
    }

    const items = await response.json();
    if (Array.isArray(items) && items.length > 0) {
      return normalizeCaseRecord(items[0]);
    }

    console.warn('[Case Fetch] No case found for caseId:', caseId);
    return null;
  } catch (error) {
    console.error('[Case Fetch] Error fetching case:', error);
    return null;
  }
};

const uniqueCases = (cases) => {
  const seen = new Set();
  return cases.filter((item) => {
    const key = String(item.id || item.caseId || item.title || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const fetchCasesForCustomerFromTicketDB = async ({
  customerEmail,
  customerPhone,
  customerName,
  limit = 50,
}) => {
  const requests = [];

  if (customerEmail) {
    requests.push(`${TICKET_DB_BASE_URL}?caseuseremail=${encodeURIComponent(customerEmail)}`);
  }

  if (customerPhone) {
    requests.push(`${TICKET_DB_BASE_URL}?casephone=${encodeURIComponent(customerPhone)}`);
  }

  if (customerName) {
    requests.push(`${TICKET_DB_BASE_URL}?caseuser=${encodeURIComponent(customerName)}`);
  }

  if (requests.length === 0) {
    return [];
  }

  try {
    const responses = await Promise.all(
      requests.map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
          return [];
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      }),
    );

    const normalized = responses
      .flat()
      .map(normalizeCaseRecord)
      .filter(Boolean);

    return uniqueCases(normalized)
      .sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, limit);
  } catch (error) {
    console.error('fetchCasesForCustomerFromTicketDB error:', error);
    return [];
  }
};

export const updateCaseNotesInTicketDB = async (caseRecordId, notes) => {
  if (!caseRecordId) {
    throw new Error('Missing case record id for notes update');
  }

  const response = await fetch(`${TICKET_DB_BASE_URL}/${encodeURIComponent(caseRecordId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ Data1: notes }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update case notes: ${errorText}`);
  }

  const data = await response.json();
  return normalizeCaseRecord(data);
};

export const updateCaseStatusInTicketDB = async (caseRecordId, status) => {
  if (!caseRecordId) {
    throw new Error('Missing case record id for status update');
  }

  const response = await fetch(`${TICKET_DB_BASE_URL}/${encodeURIComponent(caseRecordId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ casestatus: status }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update case status: ${errorText}`);
  }

  const data = await response.json();
  return normalizeCaseRecord(data);
};

export const searchCustomerInCustomerDB = async ({ customerEmail, customerPhone, customerId, customerName }) => {
  try {
    let response = null;

    if (customerEmail) {
      response = await fetch(`${CUSTOMER_DB_BASE_URL}?email=${encodeURIComponent(customerEmail)}`);
      if (response.ok) {
        const byEmail = await response.json();
        if (Array.isArray(byEmail) && byEmail.length > 0) {
          return normalizeCustomerRecord(byEmail[0]);
        }
      }
    }

    if (customerPhone) {
      response = await fetch(`${CUSTOMER_DB_BASE_URL}?phone=${encodeURIComponent(customerPhone)}`);
      if (response.ok) {
        const byPhone = await response.json();
        if (Array.isArray(byPhone) && byPhone.length > 0) {
          return normalizeCustomerRecord(byPhone[0]);
        }
      }

      response = await fetch(`${CUSTOMER_DB_BASE_URL}?mobile=${encodeURIComponent(customerPhone)}`);
      if (response.ok) {
        const byMobile = await response.json();
        if (Array.isArray(byMobile) && byMobile.length > 0) {
          return normalizeCustomerRecord(byMobile[0]);
        }
      }
    }

    if (customerId) {
      response = await fetch(`${CUSTOMER_DB_BASE_URL}/${encodeURIComponent(customerId)}`);
      if (response.ok) {
        const byId = await response.json();
        if (byId?.id) {
          return normalizeCustomerRecord(byId);
        }
      }
    }

    if (customerName) {
      response = await fetch(`${CUSTOMER_DB_BASE_URL}?name=${encodeURIComponent(customerName)}`);
      if (response.ok) {
        const byName = await response.json();
        if (Array.isArray(byName) && byName.length > 0) {
          return normalizeCustomerRecord(byName[0]);
        }
      }
    }

    return null;
  } catch (error) {
    console.error('searchCustomerInCustomerDB error:', error);
    return null;
  }
};

const searchCustomerInJDS = async ({ customerEmail, customerPhone, customerId, accessToken, workspaceId, datacenter }) => {
  if (!accessToken || !workspaceId) {
    return null;
  }

  const candidates = [customerEmail, customerPhone, customerId].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const matches = await searchCustomerByIdentity(candidate, accessToken, workspaceId, datacenter);
      if (Array.isArray(matches) && matches.length > 0) {
        return {
          ...matches[0],
          source: 'jds',
          raw: matches[0],
        };
      }
    } catch (error) {
      console.warn('searchCustomerInJDS warning:', error);
    }
  }

  return null;
};

export const enrichCustomerForCaseTask = async ({ taskContext, accessToken, workspaceId, datacenter }) => {
  const jdsCustomer = await searchCustomerInJDS({
    customerEmail: taskContext.customerEmail,
    customerPhone: taskContext.customerPhone,
    customerId: taskContext.customerId,
    accessToken,
    workspaceId,
    datacenter,
  });

  if (jdsCustomer) {
    return {
      ...jdsCustomer,
      enrichmentSource: 'jds',
      enrichmentConfidence: 'high',
    };
  }

  const fallbackCustomer = await searchCustomerInCustomerDB({
    customerEmail: taskContext.customerEmail,
    customerPhone: taskContext.customerPhone,
    customerId: taskContext.customerId,
    customerName: taskContext.customerName,
  });

  if (!fallbackCustomer) {
    return null;
  }

  return {
    ...fallbackCustomer,
    enrichmentSource: 'customer-db',
    enrichmentConfidence: 'medium',
  };
};

export const fetchCaseTaskContext = async ({
  task,
  accessToken,
  workspaceId,
  datacenter,
  historyLimit,
}) => {
  const taskContext = normalizeTaskPayload(task);
  if (taskContext.taskType !== 'case') {
    return {
      taskContext,
      caseData: null,
      customerData: null,
      history: [],
      errors: ['unsupported-task-type'],
    };
  }

  const caseData = await fetchCaseByIdFromTicketDB(taskContext.caseId);

  const customerData = await enrichCustomerForCaseTask({
    taskContext: {
      ...taskContext,
      customerEmail: taskContext.customerEmail || caseData?.customerEmail,
      customerPhone: taskContext.customerPhone || caseData?.customerPhone,
      customerName: taskContext.customerName || caseData?.customerName,
    },
    accessToken,
    workspaceId,
    datacenter,
  });

  const identityCandidates = [
    taskContext.customerEmail,
    taskContext.customerPhone,
    taskContext.customerId,
    caseData?.customerEmail,
    caseData?.customerPhone,
    customerData?.email,
    customerData?.phone,
    customerData?.customerId,
  ].filter(Boolean);

  let jdsHistory = [];
  if (accessToken && workspaceId && identityCandidates.length > 0) {
    const rawEvents = await fetchJourneyEvents(identityCandidates, accessToken, workspaceId, datacenter);
    jdsHistory = (rawEvents || []).map(normalizeJdsEvent);
  }

  const history = mergeHistory(buildTicketHistory(caseData), jdsHistory);

  return {
    taskContext,
    caseData,
    customerData,
    history: typeof historyLimit === 'number' ? history.slice(0, historyLimit) : history,
    errors: caseData ? [] : ['case-not-found'],
  };
};

// ─── Gmail API ────────────────────────────────────────────────────────────────

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Exchange a Desktop CI token for a Gmail service-account token via the Token Broker.
 * @param {string} tokenBrokerUrl - Cloud Function URL for /auth/gmail-token
 * @param {string} desktopToken   - Webex CI bearer token from Desktop SDK
 * @returns {{ gmailToken: string, expiresAt: number }}
 */
export const fetchGmailToken = async (tokenBrokerUrl, desktopToken) => {
  const response = await fetch(`${tokenBrokerUrl}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${desktopToken}`,
    },
    body: JSON.stringify({ scope: 'gmail.readonly' }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token Broker ${response.status}: ${text}`);
  }

  return response.json();
};

/**
 * Fetch a full Gmail thread by threadId.
 * @param {string} threadId
 * @param {string} gmailToken
 * @returns {object} Gmail threads.get response
 */
export const fetchEmailThread = async (threadId, gmailToken) => {
  const url = `${GMAIL_API_BASE}/threads/${encodeURIComponent(threadId)}?format=full`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${gmailToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail threads.get ${response.status}: ${text}`);
  }

  return response.json();
};

/**
 * Fetch lightweight thread metadata (headers only, no body) for display in the
 * thread list. Uses format=metadata to minimise response size.
 * Returns { threadId, subject, from, date, messageCount, snippet }.
 *
 * @param {string} threadId
 * @param {string} gmailToken
 * @returns {object}
 */
export const fetchEmailThreadMetadata = async (threadId, gmailToken) => {
  const url = `${GMAIL_API_BASE}/threads/${encodeURIComponent(threadId)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${gmailToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail threads.get (metadata) ${response.status}: ${text}`);
  }

  const data = await response.json();
  const messages = data.messages || [];
  const firstMsg = messages[0] || {};
  const lastMsg = messages[messages.length - 1] || {};

  const getHeader = (msg, name) =>
    (msg.payload?.headers || []).find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  return {
    threadId: data.id,
    subject: getHeader(firstMsg, 'Subject') || '',
    from: getHeader(firstMsg, 'From') || '',
    date: getHeader(lastMsg, 'Date') || '',
    messageCount: messages.length,
    snippet: data.snippet || lastMsg.snippet || '',
  };
};

/**
 * List Gmail threads involving a customer email address.
 * @param {string} customerEmail
 * @param {string} gmailToken
 * @returns {object} Gmail threads.list response
 */
export const fetchCustomerEmailThreads = async (customerEmail, gmailToken) => {
  const query = encodeURIComponent(`from:${customerEmail} OR to:${customerEmail}`);
  const url = `${GMAIL_API_BASE}/threads?q=${query}&maxResults=50`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${gmailToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail threads.list ${response.status}: ${text}`);
  }

  return response.json();
};

/**
 * Find a Gmail thread by RFC 2822 Message-ID using the rfc822msgid: search operator.
 * This is an exact 1:1 match — the most reliable fallback when gmailThreadId is not
 * available in CAD but the Message-Id header was forwarded through Webex Connect.
 *
 * @param {string} rfcMessageId - The raw Message-Id header value (with or without angle brackets)
 * @param {string} gmailToken
 * @returns {string|null} The Gmail threadId, or null if not found
 */
export const findGmailThreadByRfcMessageId = async (rfcMessageId, gmailToken) => {
  // Strip angle brackets if present; Gmail operator requires bare ID
  const bare = rfcMessageId.replace(/^<|>$/g, '').trim();
  if (!bare) return null;

  const query = encodeURIComponent(`rfc822msgid:${bare}`);
  const url = `${GMAIL_API_BASE}/threads?q=${query}&maxResults=2`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${gmailToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail threads.list (rfc822msgid) ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data?.threads?.[0]?.id || null;
};

/**
 * Search Gmail threads by sender and subject to identify the active thread when
 * no gmailThreadId is available in CAD. Returns the first matching thread ID or null.
 *
 * @param {string} customerEmail - The sender address (task `ani`)
 * @param {string} subject       - The email subject from mediaProperties.emailSubject
 * @param {string} gmailToken
 * @returns {string|null} The Gmail threadId of the best match, or null
 */
export const findGmailThreadBySubjectAndSender = async (customerEmail, subject, gmailToken) => {
  // Build a precise query: exact sender + subject. Gmail strips "Re:", "Fwd:" prefixes
  // automatically when matching, so the raw subject from CAD works without normalization.
  const q = [`from:${customerEmail}`];
  if (subject) q.push(`subject:"${subject.replace(/"/g, '')}"`);
  const query = encodeURIComponent(q.join(' '));
  const url = `${GMAIL_API_BASE}/threads?q=${query}&maxResults=5`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${gmailToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail threads.list (subject search) ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data?.threads?.[0]?.id || null;
};

/**
 * Fetch a single Gmail message by ID.
 * @param {string} messageId
 * @param {string} gmailToken
 * @returns {object} Gmail messages.get response
 */
export const fetchEmailMessage = async (messageId, gmailToken) => {
  const url = `${GMAIL_API_BASE}/messages/${encodeURIComponent(messageId)}?format=full`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${gmailToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail messages.get ${response.status}: ${text}`);
  }

  return response.json();
};

/**
 * Fetch a Gmail attachment by messageId and attachmentId.
 * @param {string} messageId
 * @param {string} attachmentId
 * @param {string} gmailToken
 * @returns {{ size: number, data: string }} base64url-encoded attachment data
 */
export const fetchEmailAttachment = async (messageId, attachmentId, gmailToken) => {
  const url = `${GMAIL_API_BASE}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${gmailToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail attachments.get ${response.status}: ${text}`);
  }

  return response.json();
};

/**
 * Send an email reply directly via the Gmail API (messages.send).
 * Builds a minimal multipart/alternative RFC 2822 message and base64url-encodes it.
 * Requires a Gmail token with https://mail.google.com/ scope (minted by token broker).
 *
 * @param {string} gmailToken  - Valid Gmail OAuth2 access token
 * @param {object} options
 * @param {string}  options.toAddress  - Recipient address
 * @param {string}  options.subject    - Reply subject (e.g. "Re: Original subject")
 * @param {string}  options.replyHtml  - HTML body
 * @param {string}  [options.replyText]  - Plain-text body; stripped from HTML if omitted
 * @param {string}  [options.threadId]   - Gmail threadId to keep reply in the same thread
 * @param {string}  [options.inReplyTo]  - Message-ID header of the original message
 * @param {string}  [options.references] - References header chain
 * @returns {Promise<{ id: string, threadId: string, labelIds: string[] }>}
 */
export const sendEmailViaGmail = async (gmailToken, { toAddress, subject, replyHtml, replyText, threadId, inReplyTo, references, attachments }) => {
  const plainBody = (replyText || (replyHtml || '').replace(/<[^>]+>/g, '')).trim();

  const commonHeaders = [
    `To: ${toAddress}`,
    `Subject: ${subject}`,
    ...(inReplyTo  ? [`In-Reply-To: ${inReplyTo}`]   : []),
    ...(references ? [`References: ${references}`]   : []),
    'MIME-Version: 1.0',
  ];

  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  let mime;

  if (hasAttachments) {
    const outerBoundary = `mp_mix_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const innerBoundary = `mp_alt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    // Read each File to standard base64 for MIME embedding
    const attachmentParts = await Promise.all(
      attachments.map(async (file) => {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        const safeName = file.name.replace(/"/g, '');
        return [
          `--${outerBoundary}`,
          `Content-Type: ${file.type || 'application/octet-stream'}; name="${safeName}"`,
          `Content-Disposition: attachment; filename="${safeName}"`,
          'Content-Transfer-Encoding: base64',
          '',
          b64,
        ].join('\r\n');
      })
    );

    mime = [
      [...commonHeaders, `Content-Type: multipart/mixed; boundary="${outerBoundary}"`].join('\r\n'),
      '',
      `--${outerBoundary}`,
      `Content-Type: multipart/alternative; boundary="${innerBoundary}"`,
      '',
      `--${innerBoundary}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      plainBody,
      '',
      `--${innerBoundary}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      replyHtml || '',
      '',
      `--${innerBoundary}--`,
      '',
      ...attachmentParts,
      `--${outerBoundary}--`,
    ].join('\r\n');
  } else {
    const boundary = `mp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    mime = [
      [...commonHeaders, `Content-Type: multipart/alternative; boundary="${boundary}"`].join('\r\n'),
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      plainBody,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      replyHtml || '',
      '',
      `--${boundary}--`,
    ].join('\r\n');
  }

  // base64url-encode the full RFC 2822 message (UTF-8 safe via TextEncoder)
  const bytes = new TextEncoder().encode(mime);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const raw = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const requestBody = { raw };
  if (threadId) requestBody.threadId = threadId;

  const response = await fetch(`${GMAIL_API_BASE}/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gmailToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail messages.send ${response.status}: ${text}`);
  }

  return response.json(); // { id, threadId, labelIds }
};

/**
 * POST an outbound email payload to a Webex Connect inbound webhook.
 * @param {string} webhookUrl - Webex Connect webhook URL (from widget layout config)
 * @param {object} payload    - { replyHtml, replyText, toAddress, subject, threadId, correlationId, ... }
 */
export const sendEmailViaWebexConnect = async (webhookUrl, payload) => {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Webex Connect webhook ${response.status}: ${text}`);
  }

  // Response may be empty or JSON
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return { ok: true };
};

/**
 * Poll Gmail history for changes since a known historyId.
 * Uses the cheapest possible API call — only message additions to INBOX.
 * Returns the new historyId and an array of added messageIds in the thread.
 *
 * @param {string} startHistoryId - historyId from the last full thread fetch
 * @param {string} threadId       - Only return new messages belonging to this thread
 * @param {string} gmailToken
 * @returns {{ newHistoryId: string|null, addedMessageIds: string[] }}
 */
export const pollGmailThreadHistory = async (startHistoryId, threadId, gmailToken) => {
  const params = new URLSearchParams({
    startHistoryId,
    historyTypes: 'messageAdded',
    labelId: 'INBOX',
  });
  const url = `${GMAIL_API_BASE}/history?${params}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${gmailToken}` },
  });

  // 404 means the historyId is too old (expired) — caller should do a full refresh
  if (response.status === 404) {
    return { newHistoryId: null, addedMessageIds: [], expired: true };
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail history.list ${response.status}: ${text}`);
  }

  const data = await response.json();
  const newHistoryId = data.historyId || null;
  const addedMessageIds = [];
  for (const record of (data.history || [])) {
    for (const added of (record.messagesAdded || [])) {
      if (!threadId || added.message?.threadId === threadId) {
        addedMessageIds.push(added.message.id);
      }
    }
  }
  return { newHistoryId, addedMessageIds, expired: false };
};