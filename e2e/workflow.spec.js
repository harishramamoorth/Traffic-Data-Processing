import { test, expect } from '@playwright/test';

test.describe('Traffic Data Processor E2E Flow', () => {
  test('Complete workflow: Upload -> 7 PII Columns Analysis -> 7 Config Cards -> Run Pipeline -> Consistent Results & Downloads', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      console.log(`[BROWSER ${msg.type().toUpperCase()}]`, msg.text());
      if (msg.type() === 'error') {
        const text = msg.text();
        if (
          !text.includes('THREE.Clock') &&
          !text.includes('favicon') &&
          !text.includes('WebGL') &&
          !text.includes('404')
        ) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('pageerror', err => {
      console.log('[BROWSER UNCAUGHT ERROR]', err.message);
      consoleErrors.push(err.message);
    });

    page.on('requestfailed', req => {
      console.log('[REQUEST FAILED]', req.url(), req.failure()?.errorText);
    });

    page.on('response', res => {
      if (res.url().includes('/api/')) {
        console.log('[API RESPONSE]', res.status(), res.url());
      }
    });

    // 1. Visit Upload Page
    await page.goto('/');
    await expect(page).toHaveTitle(/Traffic Data Processor/i);

    // 2. Click "Load Sample Dataset (527 Records)"
    const loadSampleBtn = page.getByRole('button', { name: /Load Sample Dataset/i });
    await expect(loadSampleBtn).toBeVisible({ timeout: 10000 });
    await loadSampleBtn.scrollIntoViewIfNeeded();
    await loadSampleBtn.click();

    // 3. Wait for Step 2 Analysis to load
    await expect(page.getByText(/Dataset Inspection & Privacy Audit/i)).toBeVisible({ timeout: 25000 });

    // Verify Analysis page shows 7 PII columns
    // Check PII Detected KPI card
    const piiCard = page.locator('text=7 sensitive attributes').first();
    await expect(piiCard).toBeVisible();

    // Verify Extracted Columns table and Heatmap are present
    await expect(page.getByText(/Column Inspection & Sparkline Telemetry/i)).toBeVisible();
    await expect(page.getByText(/Traffic Density Matrix/i)).toBeVisible();

    // 4. Proceed to Configure Page (Step 3)
    const proceedBtn = page.getByRole('button', { name: /Configure Privacy & Rules/i });
    await proceedBtn.click();

    // Wait for Configure page
    await expect(page.getByText(/Privacy Enforcement & Data Processing/i)).toBeVisible();

    // Verify Panel B shows "(7 Fields)" and renders 7 cards
    await expect(page.getByText(/Panel B: Privacy Protection \(7 Fields\)/i)).toBeVisible();
    const piiCards = page.locator('div[data-pii-card]');
    const cardCount = await piiCards.count();
    expect(cardCount).toBe(7);

    // Verify Presets & Live Trade-Off Score
    await expect(page.getByText(/Standard Compliance Presets/i)).toBeVisible();
    await expect(page.getByText(/Live Trade-Off Score/i)).toBeVisible();

    // 5. Verify Risk Reduction options on Configure Page
    await expect(page.getByText(/Risk Reduction \(k-Anonymity Guard\)/i)).toBeVisible();
    await expect(page.locator('#risk-reduction-none')).toBeVisible();
    await expect(page.locator('#risk-reduction-suppress')).toBeVisible();
    await expect(page.locator('#risk-reduction-aggregate')).toBeVisible();

    // Execute Pipeline
    const executeBtn = page.getByRole('button', { name: /Execute Pipeline/i }).first();
    await executeBtn.click();

    // Wait for Processing (Step 4) and transition to Results (Step 5)
    await expect(page.getByText(/Privacy Audit & Anonymization Results/i)).toBeVisible({ timeout: 45000 });

    // 6. Verify Results Page
    // Verify status badge & compliance warning
    await expect(page.getByText(/PASSED WITH WARNINGS/i).first()).toBeVisible();
    await expect(page.getByText(/Compliance Warning: Re-identification risk is High/i)).toBeVisible();

    // Verify Re-identification Risk Card (Requirement 2)
    const reIdCard = page.locator('#re-identification-risk-card');
    await expect(reIdCard).toBeVisible();
    await expect(reIdCard.getByText(/Re-identification Risk/i).first()).toBeVisible();
    await expect(reIdCard.getByText(/Group-Size Distribution \(k=1, 2, 3-4, 5\+\)/i)).toBeVisible();
    await expect(reIdCard.getByText(/Plain-Language Assessment/i)).toBeVisible();

    // Verify Honest Privacy Claim
    await expect(page.getByText(/No direct identifiers detected; re-identification risk:/i).first()).toBeVisible();

    // Verify Row Accounting: 527 input = 518 processed + 3 rejected + 6 duplicates
    await expect(page.getByText('527').first()).toBeVisible();
    await expect(page.getByText('518').first()).toBeVisible();

    // 7. Verify Downloads work
    // Click Downloads tab
    await page.getByRole('button', { name: /^Downloads$/i }).click();

    const downloadPromiseCsv = page.waitForEvent('download');
    await page.locator('#download-cleaned-csv').click();
    const downloadCsv = await downloadPromiseCsv;
    expect(downloadCsv.suggestedFilename()).toContain('.csv');

    // 8. Test Suppress Mode configuration via "Run again with different settings"
    await page.getByRole('button', { name: /Run again with different settings/i }).click();
    await expect(page.getByText(/Privacy Enforcement & Data Processing/i)).toBeVisible();

    // Select Suppress mode
    await page.locator('#risk-reduction-suppress').click();
    await expect(page.getByText(/Enforcing k ≥ 3/i)).toBeVisible();

    // Verify live trade-off shows before and after
    await expect(page.getByText(/Re-ID Risk Impact:/i)).toBeVisible();

    // Execute Pipeline with Suppress mode
    const executeSuppressBtn = page.getByRole('button', { name: /Execute Pipeline/i }).first();
    await executeSuppressBtn.click();

    // Wait for Results
    await expect(page.getByText(/Privacy Audit & Anonymization Results/i)).toBeVisible({ timeout: 45000 });

    // In Suppress mode with K=3: k_min >= 3, risk is Low, suppressed rows reported
    const reIdCardSuppress = page.locator('#re-identification-risk-card');
    await expect(reIdCardSuppress).toBeVisible();
    await expect(reIdCardSuppress.getByText(/Low Risk/i).first()).toBeVisible();
    await expect(page.getByText(/Suppressed \(k<K\)/i).first()).toBeVisible();

    // 9. Assert no severe console errors
    expect(consoleErrors).toEqual([]);
  });
});
