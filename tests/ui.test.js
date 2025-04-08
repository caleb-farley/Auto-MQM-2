const puppeteer = require('puppeteer');

jest.setTimeout(30000); // Increase timeout to 30 seconds

describe('Auto-MQM UI Tests', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox']
    });
    page = await browser.newPage();
    page.setDefaultTimeout(5000);

    // Set up request interception
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url().includes('/api/detect-language')) {
        const postData = JSON.parse(request.postData());
        request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            language: postData.text.toLowerCase().includes('bonjour') ? 'fr' : 'en',
            confidence: 10.7
          })
        });
      } else {
        request.continue();
      }
    });

    // Navigate to the test page
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    // Wait for initial page load
    await page.waitForSelector('#source-text');
    await page.waitForSelector('#target-text');
    await page.waitForSelector('#source-word-count');
    await page.waitForSelector('#target-word-count');

    // Wait for DOM to be fully ready
    await page.evaluate(() => {
      return new Promise(resolve => {
        if (document.readyState === 'complete') {
          resolve();
        } else {
          document.addEventListener('DOMContentLoaded', resolve);
        }
      });
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  // Helper function to wait for element to be visible
  const waitForVisible = async (selector) => {
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style && style.display !== 'none' && style.visibility !== 'hidden';
      },
      { timeout: 10000 },
      selector
    );
  };

  // Helper function to wait for content to be updated
  const waitForContent = async (selector, expectedContent) => {
    await page.waitForFunction(
      (sel, exp) => {
        const el = document.querySelector(sel);
        return el && el.textContent.includes(exp);
      },
      { timeout: 10000 },
      selector,
      expectedContent
    );
  };

  // Helper function to wait for language detection
  const waitForLanguageDetection = async (selector) => {
    await page.waitForFunction(
      () => {
        const el = document.querySelector(selector);
        return el && el.value && el.dataset.autoDetected === 'true';
      },
      { timeout: 1000 }
    );
  };

  test('Word count functionality', async () => {
    // Clear any previous text and ensure we're in bilingual mode
    await page.evaluate(() => {
      // Reset text areas and ensure bilingual mode
      const sourceText = document.getElementById('source-text');
      const targetText = document.getElementById('target-text');
      const translationModeToggle = document.getElementById('translation-mode-toggle');
      
      // Reset text
      sourceText.value = '';
      targetText.value = '';
      
      // Ensure bilingual mode
      if (translationModeToggle) {
        translationModeToggle.checked = false;
        translationModeToggle.dispatchEvent(new Event('change'));
      }
      
      // Reset containers
      const sourceContainer = document.getElementById('source-text-container');
      const targetContainer = document.getElementById('target-text-container');
      if (sourceContainer) sourceContainer.style.display = 'block';
      if (targetContainer) targetContainer.classList.remove('monolingual');
      
      // Force initial word count update
      window.AutoMQM.Core.updateWordCountDisplay();
    });

    // Test source text word count
    await page.evaluate(() => {
      const sourceText = document.getElementById('source-text');
      sourceText.value = 'This is a test sentence';
      sourceText.dispatchEvent(new Event('input', { bubbles: true }));
      window.AutoMQM.Core.updateWordCountDisplay();
    });

    await page.waitForFunction(
      () => {
        const el = document.querySelector('#source-word-count');
        return el && el.textContent === '5 / 500 words';
      },
      { timeout: 5000 }
    );

    // Test target text word count
    await page.evaluate(() => {
      const targetText = document.getElementById('target-text');
      targetText.value = 'This is another test sentence';
      targetText.dispatchEvent(new Event('input', { bubbles: true }));
      window.AutoMQM.Core.updateWordCountDisplay();
    });

    // Wait for target word count to update
    await page.waitForFunction(
      () => {
        const el = document.querySelector('#target-word-count');
        const text = el?.textContent || '';
        const words = text.split(' / ')[0];
        return words === '6';
      },
      { timeout: 5000 }
    );

    // Verify final word count
    const targetCount = await page.$eval('#target-word-count', el => el.textContent);
    expect(targetCount).toBe('6 / 500 words');
  });

  test('Language detection', async () => {
    // Clear any previous text
    await page.$eval('#source-text', el => el.value = '');
    await page.$eval('#target-text', el => el.value = '');
    await new Promise(resolve => setTimeout(resolve, 100));

    // Clear previous text
    await page.$eval('#source-text', el => el.value = '');
    await page.$eval('#target-text', el => el.value = '');

    // Test source language detection
    await page.evaluate(() => {
      const sourceText = document.getElementById('source-text');
      sourceText.value = 'Bonjour tout le monde';
      sourceText.dispatchEvent(new Event('input', { bubbles: true }));
      window.AutoMQM.Core.handleSourceLanguageDetection();
    });
    await page.waitForResponse(response => response.url().includes('/api/detect-language'));
    await page.waitForFunction(
      () => {
        const el = document.querySelector('#source-lang');
        return el && el.value === 'fr' && el.dataset.autoDetected === 'true';
      },
      { timeout: 5000 }
    );
    const sourceLang = await page.$eval('#source-lang', el => el.value);
    expect(sourceLang).toBe('fr');

    // Test target language detection
    await page.evaluate(() => {
      const targetText = document.getElementById('target-text');
      targetText.value = 'Hello everyone';
      targetText.dispatchEvent(new Event('input', { bubbles: true }));
      window.AutoMQM.Core.handleTargetLanguageDetection();
    });
    await page.waitForResponse(response => response.url().includes('/api/detect-language'));
    await page.waitForFunction(
      () => {
        const el = document.querySelector('#target-lang');
        return el && el.value === 'en' && el.dataset.autoDetected === 'true';
      },
      { timeout: 5000 }
    );
    const targetLang = await page.$eval('#target-lang', el => el.value);
    expect(targetLang).toBe('en');
  });

  test('Analyze button state', async () => {
    // Clear previous text and languages
    await page.$eval('#source-text', el => el.value = '');
    await page.$eval('#target-text', el => el.value = '');
    await page.$eval('#source-lang', el => el.value = '');
    await page.$eval('#target-lang', el => el.value = '');

    // Check initial state (should be disabled)
    await page.evaluate(() => {
      window.AutoMQM.Core.updateAnalyzeButton();
    });
    let isDisabled = await page.$eval('#analyze-btn', el => el.disabled);
    expect(isDisabled).toBe(true);

    // Add text and languages
    await page.evaluate(() => {
      document.getElementById('source-text').value = 'Source text';
      document.getElementById('target-text').value = 'Target text';
      document.getElementById('source-lang').value = 'en';
      document.getElementById('target-lang').value = 'fr';
      window.AutoMQM.Core.updateAnalyzeButton();
    });

    // Check enabled state
    await new Promise(resolve => setTimeout(resolve, 100));
    isDisabled = await page.$eval('#analyze-btn', el => el.disabled);
    expect(isDisabled).toBe(false);
  });

  test('Word count limits', async () => {
    // Clear any previous text and ensure we're in bilingual mode
    await page.evaluate(() => {
      document.getElementById('source-text').value = '';
      document.getElementById('target-text').value = '';
      const translationModeToggle = document.getElementById('translation-mode-toggle');
      if (translationModeToggle && translationModeToggle.checked) {
        translationModeToggle.checked = false;
        translationModeToggle.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create text with more than 500 words (Anonymous limit)
    const longText = 'test '.repeat(501);
    await page.evaluate((text) => {
      const sourceText = document.getElementById('source-text');
      sourceText.value = text;
      sourceText.dispatchEvent(new Event('input', { bubbles: true }));
      window.AutoMQM.Core.updateWordCountDisplay();
      window.AutoMQM.Core.updateAnalyzeButton();
    }, longText);

    // Wait for word count to update
    await page.waitForFunction(
      () => {
        const el = document.querySelector('#source-word-count');
        return el && el.textContent === '501 / 500 words';
      },
      { timeout: 5000 }
    );
    const wordCount = await page.$eval('#source-word-count', el => el.textContent);
    expect(wordCount).toBe('501 / 500 words');

    // Wait for analyze button to be disabled
    await page.waitForFunction(
      () => {
        const button = document.querySelector('#analyze-btn');
        return button && button.disabled;
      },
      { timeout: 5000 }
    );
    const isDisabled = await page.$eval('#analyze-btn', el => el.disabled);
    expect(isDisabled).toBe(true);

    // Check if warning class is applied
    const hasWarning = await page.$eval('#source-word-count', el => 
      el.classList.contains('text-warning')
    );
    expect(hasWarning).toBe(true);
  });

  test('Monolingual mode', async () => {
    // Enable monolingual mode
    await page.waitForSelector('#translation-mode-toggle');
    await page.evaluate(() => {
      document.querySelector('#translation-mode-toggle').click();
    });

    // Clear previous text
    await page.$eval('#source-text', el => el.value = '');
    await page.$eval('#target-text', el => el.value = '');

    // Wait for source container to be hidden
    await page.waitForFunction(
      () => {
        const container = document.querySelector('#source-text-container');
        return container && window.getComputedStyle(container).display === 'none';
      },
      { timeout: 10000 }
    );

    // Add target text only and verify analyze button
    await page.type('#target-text', 'Test text');
    await page.select('#target-lang', 'en');

    // Wait for analyze button to be enabled
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('#analyze-btn');
        return btn && !btn.disabled;
      },
      { timeout: 5000 }
    );

    const isDisabled = await page.$eval('#analyze-btn', el => el.disabled);
    expect(isDisabled).toBe(false);
  });
});

