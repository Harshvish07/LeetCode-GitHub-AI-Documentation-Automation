import { getExtensionStatusMessage } from '../lib/messaging.js';

chrome.runtime.onInstalled.addListener(() => {
  console.log(getExtensionStatusMessage());
});
