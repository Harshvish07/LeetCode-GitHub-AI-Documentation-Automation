import type { LeetCodeExtraction } from '@codereviewai/shared';
import { submitSubmission, toCreateSubmissionRequest } from '../lib/api.js';
import type { ExtensionMessage, ExtensionResponse } from '../lib/messaging.js';

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`popup.html is missing #${id}`);
  }
  return el as T;
}

const statusEl = requireElement<HTMLParagraphElement>('status');
const debugEl = requireElement<HTMLPreElement>('debug');
const submitButton = requireElement<HTMLButtonElement>('btn-submit');
const submitResultEl = requireElement<HTMLDivElement>('submit-result');
const fields = {
  title: requireElement<HTMLElement>('field-title'),
  difficulty: requireElement<HTMLElement>('field-difficulty'),
  language: requireElement<HTMLElement>('field-language'),
  status: requireElement<HTMLElement>('field-status'),
  runtime: requireElement<HTMLElement>('field-runtime'),
  memory: requireElement<HTMLElement>('field-memory'),
};

function renderUnavailable(): void {
  for (const el of Object.values(fields)) {
    el.textContent = 'Unavailable';
  }
}

function renderExtraction(extraction: LeetCodeExtraction): void {
  fields.title.textContent = extraction.problem.title ?? 'Unavailable';
  fields.difficulty.textContent = extraction.problem.difficulty ?? 'Unavailable';
  fields.language.textContent = extraction.submission.language ?? 'Unavailable';
  fields.status.textContent = extraction.submission.status ?? 'Unavailable';
  fields.runtime.textContent = extraction.submission.runtime ?? 'Unavailable';
  fields.memory.textContent = extraction.submission.memory ?? 'Unavailable';
}

function renderSubmitResult(kind: 'loading' | 'success' | 'error', message: string): void {
  submitResultEl.hidden = false;
  submitResultEl.textContent = message;
  submitResultEl.className = `submit-result submit-result--${kind}`;
}

function clearSubmitResult(): void {
  submitResultEl.hidden = true;
  submitResultEl.textContent = '';
  submitResultEl.className = 'submit-result';
}

async function requestExtraction(): Promise<LeetCodeExtraction> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error('No active tab found.');
  }

  const message: ExtensionMessage = { type: 'EXTRACT_LEETCODE_DATA' };
  let response: ExtensionResponse | undefined;
  try {
    response = (await chrome.tabs.sendMessage(tab.id, message)) as ExtensionResponse | undefined;
  } catch {
    throw new Error('Open a LeetCode problem page, then try again.');
  }

  if (!response) {
    throw new Error('Open a LeetCode problem page, then try again.');
  }
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.data;
}

async function handleExtract(): Promise<void> {
  statusEl.textContent = 'Extracting…';
  debugEl.hidden = true;
  clearSubmitResult();

  try {
    const extraction = await requestExtraction();
    renderExtraction(extraction);
    statusEl.textContent =
      extraction.warnings.length > 0
        ? `Extracted — ${extraction.warnings.length} field(s) unavailable.`
        : 'Extraction complete.';
  } catch (error) {
    renderUnavailable();
    statusEl.textContent = error instanceof Error ? error.message : 'Extraction failed.';
  }
}

async function handleAnalyze(): Promise<void> {
  statusEl.textContent = 'Gathering data for analysis…';
  clearSubmitResult();

  try {
    const extraction = await requestExtraction();
    renderExtraction(extraction);
    debugEl.textContent = JSON.stringify(extraction, null, 2);
    debugEl.hidden = false;
    statusEl.textContent = 'AI analysis isn’t implemented yet — showing extracted data below.';
  } catch (error) {
    renderUnavailable();
    debugEl.hidden = true;
    statusEl.textContent = error instanceof Error ? error.message : 'Extraction failed.';
  }
}

async function handleSubmit(): Promise<void> {
  submitButton.disabled = true;
  renderSubmitResult('loading', 'Extracting and submitting…');

  try {
    const extraction = await requestExtraction();
    renderExtraction(extraction);

    const outcome = await submitSubmission(toCreateSubmissionRequest(extraction));

    if (outcome.status === 'success') {
      renderSubmitResult('success', `Submitted — id ${outcome.submission.id}`);
    } else if (outcome.status === 'validation-error') {
      const issueList = outcome.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n');
      renderSubmitResult(
        'error',
        issueList.length > 0 ? `${outcome.message}:\n${issueList}` : outcome.message,
      );
    } else {
      renderSubmitResult('error', outcome.message);
    }
  } catch (error) {
    renderSubmitResult('error', error instanceof Error ? error.message : 'Submission failed.');
  } finally {
    submitButton.disabled = false;
  }
}

requireElement<HTMLButtonElement>('btn-extract').addEventListener('click', () => {
  void handleExtract();
});

requireElement<HTMLButtonElement>('btn-analyze').addEventListener('click', () => {
  void handleAnalyze();
});

submitButton.addEventListener('click', () => {
  void handleSubmit();
});
