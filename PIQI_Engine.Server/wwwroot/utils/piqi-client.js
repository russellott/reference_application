// PIQI Client - Main Entry Point
// Modular JavaScript library for PIQI client pages
// Each page must define buildRequestBody() and clearForm() locally

import { loadDropdownOptions, initializeConfigHandlers } from './piqi-utils/config-loader.js';
import { initializeModalHandlers, openValueModal, closeValueModal, copyToClipboard } from './piqi-utils/modal-manager.js';
import { toggleRawResponse, toggleAuditedMessage, toggleDCCard, filterTable } from './piqi-utils/ui-helpers.js';
import { previewRequest, displayFormattedResponse, initializeFormSubmission } from './piqi-utils/form-handler.js';
import { submitBatchForm } from './piqi-utils/batch-processor.js';

// Export public API for global access
window.piqiClient = {
    openValueModal,
    closeValueModal,
    copyToClipboard,
    toggleRawResponse,
    toggleAuditedMessage,
    toggleDCCard,
    filterTable,
    previewRequest,
    submitBatchForm
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function () {
    initializeConfigHandlers();
    initializeModalHandlers();
    initializeFormSubmission();
});
